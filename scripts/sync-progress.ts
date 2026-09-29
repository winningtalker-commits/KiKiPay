/**
 * Diagnostic: start the wallet exactly like deploy.ts does, then sample the
 * shielded child's SyncProgress (appliedIndex vs highestIndex) to measure
 * how fast the one-time history scan advances and how much remains.
 *
 *   npx tsx scripts/sync-progress.ts --network preview [sampleSeconds]
 */
import { WebSocket } from 'ws';
// @ts-expect-error wallet sync requires WebSocket
globalThis.WebSocket = WebSocket;

import { resolveNetwork, getOrCreateWallet } from '../src/network';
import { createWallet } from '../src/wallet';

const seconds = Number(process.argv[3] ?? '90') || 90;
const { network, config: networkConfig } = resolveNetwork({ argv: process.argv });
const W = getOrCreateWallet(network);

const walletCtx = await createWallet({ network, networkConfig, seed: W.seed });
console.log(`sampling shielded sync progress for ${seconds}s…`);

const samples: { applied: bigint; highest: bigint }[] = [];
const sub = walletCtx.wallet.state().subscribe((s: any) => {
  // The facade's state object nests each child wallet; hunt for any object
  // carrying SyncProgress-shaped fields and print its path once.
  const seen = new Set<any>();
  const visit = (obj: any, path: string) => {
    if (!obj || typeof obj !== 'object' || seen.has(obj)) return;
    seen.add(obj);
    if (typeof obj.appliedIndex === 'bigint') {
      const last = samples[samples.length - 1];
      if (!last || last.applied !== obj.appliedIndex) {
        samples.push({ applied: obj.appliedIndex, highest: obj.highestIndex });
        const pct =
          obj.highestIndex > 0n ? Number((obj.appliedIndex * 10000n) / obj.highestIndex) / 100 : 0;
        console.log(
          `${path}: applied=${obj.appliedIndex} highest=${obj.highestIndex} (${pct.toFixed(1)}%)`,
        );
      }
    }
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'object') visit(v, path ? `${path}.${k}` : k);
    }
  };
  visit(s, 'state');
});

setTimeout(async () => {
  sub.unsubscribe();
  if (samples.length >= 2) {
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dApplied = last.applied - first.applied;
    const dMs = 0; // intervals are event-driven; rate printed below is per-sample-window
    void dMs;
    console.log(`\nscan advanced ${dApplied} indexes during this ${seconds}s window`);
    const remaining = last.highest - last.applied;
    if (dApplied > 0n) {
      const estSec = Number((remaining * BigInt(seconds)) / dApplied);
      console.log(`remaining ≈ ${remaining} indexes → ~${Math.round(estSec / 60)} min at this rate`);
    }
  } else {
    console.log('no progress fields observed (state shape differs — will keep resume-based approach)');
  }
  await walletCtx.wallet.stop();
  process.exit(0);
}, seconds * 1000);
