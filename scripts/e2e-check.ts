/**
 * End-to-end smoke check for KiKiPay.
 *
 * Reconnects to the deployed contract and reads its public ledger state,
 * exiting 0 on success. Used by `npm run test:e2e` and CI workflows.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import { Buffer } from 'buffer';

import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';

import { resolveNetwork, getOrCreateWallet, getDeployment } from '../src/network';
import { createWallet, persistWalletState } from '../src/wallet';
import { witnesses } from '../contracts/witnesses.js';

// @ts-expect-error wallet sync requires WebSocket
globalThis.WebSocket = WebSocket;

const PRIVATE_STATE_ID = 'kikipayPrivateState';

function fail(msg: string): never {
  console.error(`❌ e2e-check failed: ${msg}`);
  process.exit(1);
}

function isHexAddress(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-fA-F]+$/.test(s) && s.length >= 32;
}

async function main() {
  const { network, config: networkConfig } = resolveNetwork();
  const deployment = getDeployment(network);
  if (!deployment) {
    console.error(`No deploy on file for network ${network}.`);
    process.exit(1);
  }
  if (!isHexAddress(deployment.address)) {
    fail(`Deployment address missing or invalid: ${JSON.stringify(deployment, null, 2)}`);
  }

  const zkConfigPath = path.resolve('contracts', 'managed', 'kikipay');
  const contractPath = path.join(zkConfigPath, 'contract', 'index.js');
  if (!fs.existsSync(contractPath)) fail('Compiled contract missing — run `npm run compile`.');
  const KikiPay = await import(pathToFileURL(contractPath).href);
  const withWitnesses = CompiledContract.withWitnesses as unknown as (
    w: unknown,
  ) => (self: unknown) => unknown;
  const withAssets = CompiledContract.withCompiledFileAssets as unknown as (
    p: string,
  ) => (self: unknown) => unknown;
  const compiledContract = CompiledContract.make('kikipay', KikiPay.Contract)
    .pipe(withWitnesses(witnesses), withAssets(zkConfigPath));

  const WALLET = getOrCreateWallet(network);
  const walletCtx = await createWallet({ network, networkConfig, seed: WALLET.seed });
  await walletCtx.wallet.waitForSyncedState();
  await persistWalletState(network, walletCtx);

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  const walletProvider = {
    getCoinPublicKey: () => walletCtx.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => walletCtx.shieldedSecretKeys.encryptionPublicKey,
    async balanceTx() {
      throw new Error('e2e-check is read-only and should not balance transactions');
    },
    submitTx() {
      throw new Error('e2e-check is read-only and should not submit transactions');
    },
  } as any;

  const providers = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'kikipay-state',
      accountId: walletCtx.unshieldedKeystore.getBech32Address().toString(),
      privateStoragePasswordProvider: () =>
        process.env.PRIVATE_STATE_PASSWORD?.trim() || 'Local-Devnet-Development-Placeholder-1',
    }),
    publicDataProvider: indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(networkConfig.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };

  try {
    await findDeployedContract(providers, {
      contractAddress: deployment.address,
      compiledContract: compiledContract as any,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: {
        paymasterSecret: new Uint8Array(32),
        payeeSecret: new Uint8Array(32),
        proofPath: [new Uint8Array(32), new Uint8Array(32), new Uint8Array(32), new Uint8Array(32)],
        sideBits: [false, false, false, false],
        paymentAmount: 0n,
      },
    });
  } catch (err: any) {
    await walletCtx.wallet.stop();
    fail(`findDeployedContract threw: ${err?.message ?? err}`);
  }

  const onChainState = await providers.publicDataProvider.queryContractState(deployment.address);
  if (!onChainState) {
    await walletCtx.wallet.stop();
    fail(`queryContractState returned null for ${deployment.address}`);
  }
  const l = KikiPay.ledger(onChainState.data);
  console.log('✅ e2e-check passed');
  console.log(`   contractAddress: ${deployment.address}`);
  console.log(`   network:         ${network}`);
  console.log(`   paymentCount:    ${l.paymentCount}`);
  console.log(`   potRoot set:     ${Buffer.from(l.potRoot).some((b) => b !== 0)}`);

  await walletCtx.wallet.stop();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
