/**
 * Demo video driver.
 *
 * Records the LIVE dApp (https://kikipay.vercel.app) with Playwright while a
 * mock wallet connector is injected under window.midnight. The mock implements
 * the same dapp-connector-api surface Lace does, backed by the local tx-relay
 * (the project's funded preprod test wallet). Every on-screen state is real:
 * real addresses, a real locally-generated proof, a real preprod tx, and the
 * live indexer read afterwards.
 *
 * DEMO DISCLOSURE: the mock stands in for Lace's approve-click and signing /
 * relaying role so the recording can run headless. Nothing else is faked.
 *
 * Usage: node scripts/demo-driver.mjs [base-url] [out.webm]
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = process.argv[2] || 'https://kikipay.vercel.app';
const OUT = process.argv[3] || '/tmp/demo-raw.webm';
const RELAY = 'http://127.0.0.1:8787';

// Wait for the relay wallet to finish syncing.
for (let i = 0; i < 120; i++) {
  try {
    const h = await (await fetch(`${RELAY}/health`)).json();
    if (h.ready) break;
  } catch {
    /* not up yet */
  }
  await new Promise((r) => setTimeout(r, 5000));
}
const info = await (await fetch(`${RELAY}/info`)).json();
console.log('relay wallet:', info.unshieldedAddress);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  recordVideo: { dir: '/tmp/demo-video', size: { width: 1280, height: 900 } },
});
const page = await context.newPage();

// Inject the mock connector BEFORE any app script runs. The shape mirrors
// @midnight-ntwrk/dapp-connector-api's InitialAPI / ConnectedAPI.
await page.addInitScript(
  ({ relay, walletInfo }) => {
    const hexToBytes = (h) => {
      const c = h.startsWith('0x') ? h.slice(2) : h;
      const out = new Uint8Array(c.length / 2);
      for (let i = 0; i < out.length; i++) out[i] = parseInt(c.slice(i * 2, i * 2 + 2), 16);
      return out;
    };

    const connectedAPI = {
      name: 'Lace (demo harness)',
      rdns: 'io.lace.midnight.demo',
      apiVersion: '4.0.1',

      async getConfiguration() {
        return {
          indexerUri: 'https://indexer.preprod.midnight.network/api/v4/graphql',
          indexerWsUri: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
          substrateNodeUri: 'https://rpc.preprod.midnight.network',
          networkId: 'preprod',
        };
      },

      async getShieldedAddresses() {
        return {
          shieldedAddress: walletInfo.shieldedAddress,
          shieldedCoinPublicKey: walletInfo.shieldedCoinPublicKey,
          shieldedEncryptionPublicKey: walletInfo.shieldedEncryptionPublicKey,
        };
      },

      async getUnshieldedAddress() {
        return { unshieldedAddress: walletInfo.unshieldedAddress };
      },

      async getDustAddress() {
        return { dustAddress: walletInfo.unshieldedAddress };
      },

      async getShieldedBalances() {
        return {};
      },
      async getUnshieldedBalances() {
        return {};
      },
      async getDustBalance() {
        return { cap: 0n, balance: 0n };
      },
      async getTxHistory() {
        return [];
      },
      async getConnectionStatus() {
        return { status: 'connected', networkId: 'preprod' };
      },
      async hintUsage() {},
      async signData() {
        throw new Error('not needed for the demo flow');
      },
      async makeTransfer() {
        throw new Error('not needed for the demo flow');
      },
      async makeIntent() {
        throw new Error('not needed for the demo flow');
      },
      async balanceSealedTransaction() {
        throw new Error('not needed for the demo flow');
      },

      // The two seams midnight-js actually drives during a contract call:
      async balanceUnsealedTransaction(txHex) {
        const res = await fetch(`${relay}/balance`, {
          method: 'POST',
          body: txHex,
        });
        if (!res.ok) throw new Error(`relay balance failed: ${res.status}`);
        const { tx } = await res.json();
        return { tx };
      },

      async submitTransaction(txHex) {
        const res = await fetch(`${relay}/submit`, {
          method: 'POST',
          body: txHex,
        });
        if (!res.ok) throw new Error(`relay submit failed: ${res.status}`);
        await res.json();
      },

      // Proving: return undefined → the dApp falls back to its configured
      // HTTP proof server (httpClientProofProvider), which the browser calls
      // directly (the Midnight proof server is CORS-open). That path is the
      // genuine local in-browser proof generation flow.
      async getProvingProvider() {
        return undefined;
      },
    };

    window.midnight = {
      'io.lace.midnight': {
        name: 'Lace',
        rdns: 'io.lace.midnight',
        apiVersion: '4.0.1',
        icon: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"></svg>'),
        connect: async () => connectedAPI,
      },
    };
  },
  { relay: RELAY, walletInfo: info },
);

// ── the recording scenario (the 4-beat rubric) ───────────────────────────────
await page.goto(BASE, { waitUntil: 'networkidle' });
console.log('page loaded');

// Let the ledger read resolve so beat 3 has data.
await page.getByTestId('ledger').waitFor({ state: 'visible', timeout: 30000 });
await page.waitForTimeout(1500);

// Beat 1 — connect
await page.getByTestId('connect').click();
console.log('connect clicked');
await page
  .getByTestId('wallet-address')
  .waitFor({ state: 'visible', timeout: 30000 });
console.log('wallet connected, address visible');
await page.waitForTimeout(2500); // let the viewer read the address

// Beat 2 — call the circuit (loading state during proof generation)
await page.getByTestId('call-register').click();
console.log('registerPot clicked — proving…');

// Wait for either the result or an error, up to 4 minutes (19MB key download
// + proof generation + submit + indexer latency).
const result = page.getByTestId('call-result');
const callError = page.getByTestId('call-error');
await Promise.race([
  result.waitFor({ state: 'visible', timeout: 240000 }),
  callError.waitFor({ state: 'visible', timeout: 240000 }),
]);

if (await callError.isVisible().catch(() => false)) {
  console.error('CALL FAILED:', await callError.textContent());
  await page.waitForTimeout(4000);
  await context.close();
  await browser.close();
  process.exit(1);
}
console.log('call succeeded:', (await result.textContent()).slice(0, 120));

// Beat 3 — the ledger panel refreshes with the new root/count.
await page.waitForTimeout(6000);
await page.getByTestId('refresh-ledger').click().catch(() => {});
await page.waitForTimeout(4000);

// Beat 4 — scroll through the page so the viewer sees no private data.
await page.mouse.wheel(0, 300);
await page.waitForTimeout(1200);
await page.mouse.wheel(0, -300);
await page.waitForTimeout(1500);

const video = await page.video();
await context.close(); // flushes the video file
const saved = await video?.path();
console.log('video saved:', saved);
await browser.close();
console.log('DONE');
