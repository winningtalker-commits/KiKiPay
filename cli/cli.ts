/**
 * Interactive CLI for the deployed KiKiPay contract.
 *
 * Offline demo mode (no wallet, no network — great for screenshots):
 *   npm run cli -- --demo
 *
 * On-chain mode (after `npm run deploy`):
 *   npm run cli
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import { Buffer } from 'buffer';

import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';

import { resolveNetwork, getOrCreateWallet, formatWalletBackupNotice, getDeployment } from './network';
import { createWallet, persistWalletState, unshieldedToken } from './wallet';
import { buildMemberTree, bytes32, deriveSecret } from './merkle';
import {
  witnesses,
  createKikiPayPrivateState,
  type KikiPayPrivateState,
} from '../contracts/witnesses.js';

// @ts-expect-error Required for wallet sync
globalThis.WebSocket = WebSocket;

const PRIVATE_STATE_ID = 'kikipayPrivateState';

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

// ─── Offline demo mode ─────────────────────────────────────────────────────────

async function demoMode() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║            KiKiPay — offline demo (local circuits)            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log('  Running the compiled circuits directly — no wallet, no network.\n');

  const { Contract, ledger, pureCircuits } = await import(
    pathToFileURL(path.resolve('contracts/managed/kikipay/contract/index.js')).href
  );
  const { createCircuitContext, createConstructorContext, sampleContractAddress } = await import(
    '@midnight-ntwrk/compact-runtime'
  );

  // 4 members: alice is the sponsor/paymaster, bob/carol/dave are staff.
  const names = ['alice (paymaster)', 'bob', 'carol', 'dave'];
  const tree = buildMemberTree([deriveSecret(1), deriveSecret(2), deriveSecret(3), deriveSecret(4)]);
  const [alice, bob, carol] = tree.members;

  const initial: KikiPayPrivateState = createKikiPayPrivateState(
    alice.secret, alice.secret, alice.path, alice.side, 0n,
  );
  // Contract comes from a dynamic import (untyped): use `any` internally.
  const contract = new Contract(witnesses) as any;
  const constructed = await contract.initialState(
    createConstructorContext(initial, '0'.repeat(64)),
  );
  let ctx = createCircuitContext(
    sampleContractAddress(), constructed.currentZswapLocalState,
    constructed.currentContractState, initial,
  );
  const asState = (ps: KikiPayPrivateState) => ({
    ...ctx, currentPrivateState: ps,
  }) as typeof ctx;
  const showLedger = () => {
    const l = ledger(ctx.currentQueryContext.state);
    console.log('  ── PUBLIC LEDGER ──────────────────────────────');
    console.log(`  potRoot               : ${hex(l.potRoot).slice(0, 16)}…`);
    console.log(`  paymaster (commitment): ${hex(l.paymaster).slice(0, 16)}…`);
    console.log(`  lastPaymentCommitment : ${hex(l.lastPaymentCommitment).slice(0, 16)}…`);
    console.log(`  paymentCount          : ${l.paymentCount}`);
  };

  console.log('  1. Registering pot with 4 members (root published, WHO stays hidden)');
  const r1 = await contract.impureCircuits.registerPot(asState(initial), tree.root);
  ctx = r1.context;
  showLedger();

  console.log('\n  2. Paying bob 1,000 units — amount & identity stay private');
  const payBob = createKikiPayPrivateState(alice.secret, bob.secret, bob.path, bob.side, 1_000n);
  const r2 = await contract.impureCircuits.pay(asState(payBob));
  ctx = r2.context;
  showLedger();

  console.log('\n  3. Paying carol 2,500 units — again, only a commitment appears');
  const payCarol = createKikiPayPrivateState(alice.secret, carol.secret, carol.path, carol.side, 2_500n);
  const r3 = await contract.impureCircuits.pay(asState(payCarol));
  ctx = r3.context;
  showLedger();

  console.log('\n  ✓ Demo complete. On-chain an observer sees: a root, a paymaster');
  console.log('    commitment, two payment commitments, and a count of 2 — and');
  console.log('    NOTHING about who was paid or how much.');
  void names; void pureCircuits; void bytes32;
}

// ─── On-chain mode ─────────────────────────────────────────────────────────────

async function chainMode() {
  const { network, config: networkConfig } = resolveNetwork();
  const WALLET = getOrCreateWallet(network);
  {
    const notice = formatWalletBackupNotice(WALLET, network);
    if (notice) console.log(notice);
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                       KiKiPay CLI                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const deployment = getDeployment(network);
  if (!deployment) {
    console.error(`No deploy on file for network ${network}. Run \`npm run deploy -- --network ${network}\` first.`);
    process.exit(1);
  }
  console.log(`  Contract: ${deployment.address}`);
  console.log(`  Network:  ${network}\n`);

  const zkConfigPath = path.resolve('contracts', 'managed', 'kikipay');
  const contractPath = path.join(zkConfigPath, 'contract', 'index.js');
  if (!fs.existsSync(contractPath)) {
    console.error('\n❌ Contract not compiled! Run: npm run compile\n');
    process.exit(1);
  }
  const KikiPay = await import(pathToFileURL(contractPath).href);
  const withWitnesses = CompiledContract.withWitnesses as unknown as (
    w: unknown,
  ) => (self: unknown) => unknown;
  const withAssets = CompiledContract.withCompiledFileAssets as unknown as (
    p: string,
  ) => (self: unknown) => unknown;
  const compiledContract = CompiledContract.make('kikipay', KikiPay.Contract)
    .pipe(withWitnesses(witnesses), withAssets(zkConfigPath));

  const walletCtx = await createWallet({ network, networkConfig, seed: WALLET.seed });
  console.log('  Syncing with network...');
  const state = await walletCtx.wallet.waitForSyncedState();
  await persistWalletState(network, walletCtx);
  const balance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
  console.log(`  Balance: ${balance.toLocaleString()} tNight\n`);
  if (balance === 0n && network !== 'undeployed' && networkConfig.faucet) {
    console.log(`  ⚠ No tNight. Fund the wallet to send transactions:`);
    console.log(`     ${networkConfig.faucet}`);
    console.log(`     Wallet: ${walletCtx.unshieldedKeystore.getBech32Address()}\n`);
  }

  const privateStatePassword =
    process.env.PRIVATE_STATE_PASSWORD?.trim() || 'Local-Devnet-Development-Placeholder-1';
  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  const walletProvider = {
    getCoinPublicKey: () => walletCtx.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => walletCtx.shieldedSecretKeys.encryptionPublicKey,
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      return walletCtx.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx) as any,
  };
  const providers = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'kikipay-state',
      accountId: walletCtx.unshieldedKeystore.getBech32Address().toString(),
      privateStoragePasswordProvider: () => privateStatePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(networkConfig.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };

  const deployed: any = await findDeployedContract(providers, {
    compiledContract: compiledContract as any,
    contractAddress: deployment.address,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: createKikiPayPrivateState(
      new Uint8Array(32), new Uint8Array(32),
      [new Uint8Array(32), new Uint8Array(32), new Uint8Array(32), new Uint8Array(32)],
      [false, false, false, false], 0n,
    ),
  });
  console.log('  ✅ Connected!\n');

  // Local member registry for the demo session.
  const memberNames = ['alice', 'bob', 'carol', 'dave'];
  const tree = buildMemberTree(memberNames.map((_, i) => deriveSecret(i + 1)));

  const rl = createInterface({ input: stdin, output: stdout });
  let running = true;
  while (running) {
    console.log('─── Menu ───────────────────────────────────────────────────────');
    console.log('  1. Register pot (4 demo members)');
    console.log('  2. Pay a member (choose payee + amount)');
    console.log('  3. Read public ledger');
    console.log('  4. Check wallet balance');
    console.log('  5. Exit\n');
    const choice = await rl.question('  Your choice: ');

    try {
      switch (choice.trim()) {
        case '1': {
          console.log('\n  Submitting registerPot (30-60s: ZK proof + chain)...');
          const pm = tree.members[0];
          const ps = createKikiPayPrivateState(pm.secret, pm.secret, pm.path, pm.side, 0n);
          const tx = await deployed.callTx.registerPot(tree.root, { privateState: ps });
          console.log(`\n  ✅ Pot registered. Root: ${hex(tree.root).slice(0, 24)}…`);
          console.log(`  Tx: ${tx.public.txId}  block: ${tx.public.blockHeight}\n`);
          break;
        }
        case '2': {
          const who = await rl.question(`  Pay who? (${memberNames.join('/')}): `);
          const idx = memberNames.indexOf(who.trim().toLowerCase());
          if (idx < 1) { console.log('  ❌ pick bob, carol or dave\n'); break; }
          const amt = BigInt(await rl.question('  Amount (kept private!): '));
          console.log('\n  Submitting pay (30-60s: ZK proof + chain)...');
          const pm = tree.members[0];
          const payee = tree.members[idx];
          const ps = createKikiPayPrivateState(pm.secret, payee.secret, payee.path, payee.side, amt);
          const tx = await deployed.callTx.pay({ privateState: ps });
          console.log(`\n  ✅ Payment made. On-chain commitment: ${hex(tx.public.result ?? new Uint8Array()).slice(0, 24)}…`);
          console.log(`  Tx: ${tx.public.txId}  block: ${tx.public.blockHeight}\n`);
          break;
        }
        case '3': {
          const contractState = await providers.publicDataProvider.queryContractState(deployment.address);
          if (contractState) {
            const l = KikiPay.ledger(contractState.data);
            console.log('\n  ── PUBLIC LEDGER (what everyone can see) ─────');
            console.log(`  potRoot               : ${hex(l.potRoot)}`);
            console.log(`  paymaster (commitment): ${hex(l.paymaster)}`);
            console.log(`  lastPaymentCommitment : ${hex(l.lastPaymentCommitment)}`);
            console.log(`  paymentCount          : ${l.paymentCount}\n`);
          } else {
            console.log('\n  📋 Contract state not found yet.\n');
          }
          break;
        }
        case '4': {
          const s = await walletCtx.wallet.waitForSyncedState();
          console.log(`\n  tNight: ${(s.unshielded.balances[unshieldedToken().raw] ?? 0n).toLocaleString()}`);
          console.log(`  DUST  : ${s.dust.balance(new Date()).toLocaleString()}\n`);
          break;
        }
        case '5':
          running = false;
          console.log('\n  👋 Goodbye!\n');
          break;
        default:
          console.log('\n  ❌ Invalid choice. Please enter 1-5.\n');
      }
    } catch (error) {
      console.error('\n  ❌ Failed:', error instanceof Error ? error.message : error, '\n');
    }
  }
  await persistWalletState(network, walletCtx);
  await walletCtx.wallet.stop();
  rl.close();
}

if (process.argv.includes('--demo')) {
  demoMode().catch((e) => { console.error(e); process.exit(1); });
} else {
  chainMode().catch((e) => { console.error(e); process.exit(1); });
}
