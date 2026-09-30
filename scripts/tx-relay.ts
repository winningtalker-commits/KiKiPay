/**
 * Local transaction relay for the demo recording session.
 *
 * The recorded browser session drives the real dApp; the mock wallet connector
 * (injected by the recording driver) forwards balance/submit calls here, where
 * the project's FUNDED PREPROD TEST WALLET pays fees and relays to the network
 * — the same job Lace would do for a real user.
 *
 * DEMO DISCLOSURE: this stands in for the wallet's signing/relaying role so
 * the recording can run headless. The proof generation is still done locally
 * (the proof server), the circuit call is real, and the transaction is really
 * submitted to Preprod.
 *
 * Endpoints (all CORS-open, JSON/hex bodies):
 *   GET  /health   → { ready }
 *   GET  /info     → addresses + bech32m-encoded keys for the mock connector
 *   POST /balance  → body: hex of unbound tx → { tx: hex of sealed tx }
 *   POST /submit   → body: hex of sealed tx → { txId }
 */
import * as http from 'node:http';
import { WebSocket } from 'ws';

// @ts-expect-error wallet sync requires WebSocket
globalThis.WebSocket = WebSocket;

import { NETWORK_CONFIGS } from '../cli/network';
import { createWallet } from '../cli/wallet';
import { getOrCreateWallet } from '../cli/network';

const PORT = 8787;

// biome-ignore lint/suspicious/noConsole: server logging
const log = (...args: unknown[]) => console.log('[relay]', ...args);

interface RelayWallet {
  wallet: {
    waitForSyncedState(): Promise<unknown>;
    balanceUnboundTransaction(
      tx: unknown,
      keys: unknown,
      opts?: unknown,
    ): Promise<unknown>;
    finalizeRecipe(recipe: unknown): Promise<{ serialize(): Uint8Array }>;
    submitTransaction(tx: unknown): Promise<unknown>;
    stop(): Promise<void>;
  };
  shieldedSecretKeys: { coinPublicKey: { toString(): string } };
  dustSecretKey: unknown;
  unshieldedKeystore: { getBech32Address(): { toString(): string } };
}

let relayWallet: RelayWallet | null = null;
let walletInfo: Record<string, string> = {};

const hex = (b: Uint8Array): string =>
  Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

async function startWallet(): Promise<void> {
  const creds = getOrCreateWallet('preprod');
  log('loading preprod wallet, syncing…');
  const ctx = (await createWallet({
    network: 'preprod',
    networkConfig: NETWORK_CONFIGS.preprod,
    seed: creds.seed,
  })) as unknown as RelayWallet;

  await ctx.wallet.waitForSyncedState();
  relayWallet = ctx;
  log('wallet synced.');

  // Bech32m-encode the hex keys for the mock connector, matching the shape
  // Lace returns from getShieldedAddresses().
  const { bech32m } = await import('bech32');
  const toB32 = (hexStr: string, prefix: string): string => {
    const bytes = new Uint8Array(
      (hexStr.match(/.{1,2}/g) ?? []).map((x) => parseInt(x, 16)),
    );
    // 8-bit → 5-bit groups
    let acc = 0;
    let bits = 0;
    const words: number[] = [];
    for (const byte of bytes) {
      acc = (acc << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        bits -= 5;
        words.push((acc >> bits) & 31);
      }
    }
    if (bits) words.push((acc << (5 - bits)) & 31);
    return bech32m.encode(prefix, words);
  };

  const coinHex = ctx.shieldedSecretKeys.coinPublicKey.toString();
  walletInfo = {
    unshieldedAddress: ctx.unshieldedKeystore.getBech32Address().toString(),
    coinPublicKeyHex: coinHex,
    coinPublicKeyBech32: toB32(coinHex, 'mnidcoin'),
  };
  // shieldedAddress: the bech32m coin public key with the shielded prefix —
  // the connector's "shielded address" surface. Derive deterministically.
  walletInfo.shieldedAddress = toB32(coinHex, 'mnaddr');
  walletInfo.shieldedCoinPublicKey = walletInfo.coinPublicKeyBech32;
  walletInfo.shieldedEncryptionPublicKey = toB32(coinHex, 'mnidepk');

  log('info:', walletInfo.unshieldedAddress);
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  const readBody = (): Promise<string> =>
    new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (c: string) => (data += c));
      req.on('end', () => resolve(data.trim()));
      req.on('error', reject);
    });

  try {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ ready: relayWallet !== null }));
      return;
    }
    if (req.url === '/info') {
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify(walletInfo));
      return;
    }
    if (!relayWallet) {
      res.writeHead(503, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ error: 'wallet still syncing' }));
      return;
    }

    if (req.url === '/balance' && req.method === 'POST') {
      const txHex = await readBody();
      const bytes = new Uint8Array(
        (txHex.match(/.{1,2}/g) ?? []).map((x) => parseInt(x, 16)),
      );
      const { Transaction } = await import(
        '@midnight-ntwrk/midnight-js-protocol/ledger'
      );
      const tx = Transaction.deserialize(
        'signature',
        'proof',
        'binding',
        bytes,
      );
      log('balancing tx…');
      const recipe = await relayWallet.wallet.balanceUnboundTransaction(tx, {
        shieldedSecretKeys: relayWallet.shieldedSecretKeys,
        dustSecretKey: relayWallet.dustSecretKey,
      });
      const finalized = await relayWallet.wallet.finalizeRecipe(recipe);
      log('balanced:', `${finalized.serialize().length} bytes`);
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ tx: hex(finalized.serialize()) }));
      return;
    }

    if (req.url === '/submit' && req.method === 'POST') {
      const txHex = await readBody();
      const bytes = new Uint8Array(
        (txHex.match(/.{1,2}/g) ?? []).map((x) => parseInt(x, 16)),
      );
      const { Transaction } = await import(
        '@midnight-ntwrk/midnight-js-protocol/ledger'
      );
      const tx = Transaction.deserialize(
        'signature',
        'proof',
        'binding',
        bytes,
      );
      log('submitting tx to preprod…');
      await relayWallet.wallet.submitTransaction(tx);
      const [txId] = tx.identifiers();
      log('submitted:', txId ?? '(no id)');
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ txId: txId ?? '' }));
      return;
    }

    res.writeHead(404, CORS);
    res.end();
  } catch (e) {
    log('error:', e instanceof Error ? e.message : e);
    res.writeHead(500, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({ error: String(e) }));
  }
});

server.listen(PORT, () => log(`listening on http://127.0.0.1:${PORT}`));
void startWallet();
