/**
 * Prepare the demo relay wallet (scripts/tx-relay.ts) for the recording:
 *
 *   1. create or load the preprod wallet (.midnight-state.json, gitignored)
 *   2. sync with the network
 *   3. wait until the wallet holds tNIGHT (exit 2 with the address if not —
 *      fund it at the faucet, then re-run this script)
 *   4. register the NIGHT UTXOs for DUST generation (fees) — the same flow
 *      cli/deploy.ts uses
 *   5. wait until the DUST balance is positive
 *
 * Usage: NODE_OPTIONS="--max-old-space-size=8192" npx tsx scripts/fund-demo-wallet.ts
 */
import { WebSocket } from 'ws';
import * as Rx from 'rxjs';

// @ts-expect-error wallet sync requires WebSocket
globalThis.WebSocket = WebSocket;

import { NETWORK_CONFIGS, getOrCreateWallet, formatWalletBackupNotice } from '../cli/network';
import { createWallet, persistWalletState, unshieldedToken } from '../cli/wallet';

const NETWORK = 'preprod' as const;
const FUND_TIMEOUT_MS = 15 * 60 * 1000;
const DUST_TIMEOUT_MS = 8 * 60 * 1000;

const wallet = getOrCreateWallet(NETWORK);
const notice = formatWalletBackupNotice(wallet, NETWORK);
if (notice) console.log(notice);

console.log(`[fund] creating wallet context (network: ${NETWORK})…`);
const ctx = await createWallet({
  network: NETWORK,
  networkConfig: NETWORK_CONFIGS[NETWORK],
  seed: wallet.seed,
});

// The public RPC drops websockets under load; the wallet SDK's dust sync can
// die with an unhandled rejection mid-first-sync. Persist whatever partial
// state exists so the next attempt RESUMES instead of starting over.
process.on('unhandledRejection', async (err) => {
  console.error('[fund] unhandled rejection — persisting partial state:', err);
  try {
    await persistWalletState(NETWORK, ctx);
  } catch {
    /* best effort */
  }
  process.exit(1);
});

console.log('[fund] waiting for first sync…');
let state = await Rx.firstValueFrom(
  ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)),
);
const address = ctx.unshieldedKeystore.getBech32Address().toString();
console.log('[fund] address:', address);

// Persist immediately so a later re-run restores instead of re-syncing.
await persistWalletState(NETWORK, ctx);

// ── 3. wait for tNIGHT ────────────────────────────────────────────────────────
const token = unshieldedToken().raw;
let tnight = state.unshielded.balances[token] ?? 0n;
if (tnight === 0n) {
  console.log(`[fund] no tNIGHT yet — fund ${address} at the preprod faucet.`);
  console.log('[fund] polling for funds (10s interval)…');
  const start = Date.now();
  while (tnight === 0n) {
    if (Date.now() - start > FUND_TIMEOUT_MS) {
      console.error(`[fund] TIMEOUT waiting for tNIGHT. Address: ${address}`);
      await ctx.wallet.stop();
      process.exit(2);
    }
    await new Promise((r) => setTimeout(r, 10_000));
    state = await Rx.firstValueFrom(
      ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)),
    );
    tnight = state.unshielded.balances[token] ?? 0n;
  }
}
console.log(`[fund] tNIGHT balance: ${tnight.toLocaleString()}`);

// ── 4. register NIGHT UTXOs for DUST ──────────────────────────────────────────
const unregistered = state.unshielded.availableCoins.filter(
  (c: any) => !c.meta?.registeredForDustGeneration,
);
if (unregistered.length > 0) {
  console.log(`[fund] registering ${unregistered.length} NIGHT UTXO(s) for DUST…`);
  const recipe = await ctx.wallet.registerNightUtxosForDustGeneration(
    unregistered,
    ctx.unshieldedKeystore.getPublicKey(),
    (payload) => ctx.unshieldedKeystore.signData(payload),
  );
  const finalized = await ctx.wallet.finalizeRecipe(recipe);
  await ctx.wallet.submitTransaction(finalized);
  console.log('[fund] DUST registration tx submitted.');
} else {
  console.log('[fund] all UTXOs already registered for DUST.');
}

// ── 5. wait for DUST ──────────────────────────────────────────────────────────
try {
  console.log('[fund] waiting for DUST to become available…');
  await Rx.firstValueFrom(
    ctx.wallet.state().pipe(
      Rx.throttleTime(5000),
      Rx.filter((s) => s.isSynced),
      Rx.filter((s) => s.dust.balance(new Date()) > 0n),
      Rx.timeout({ first: DUST_TIMEOUT_MS }),
    ),
  );
  const dust = await Rx.firstValueFrom(
    ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)),
  );
  console.log(`[fund] DUST ready: ${dust.dust.balance(new Date()).toLocaleString()}`);
} catch {
  console.error('[fund] TIMEOUT waiting for DUST — re-run this script.');
  await ctx.wallet.stop();
  process.exit(3);
}

await persistWalletState(NETWORK, ctx);
console.log('[fund] wallet state persisted — the relay can start now.');
await ctx.wallet.stop();
console.log('READY');
