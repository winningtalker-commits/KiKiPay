import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';

/**
 * KiKiPay frontend build.
 *
 * The Midnight.js stack is Node-first: it expects `global`, `process`,
 * `Buffer`, `events`, `stream` and (in some transitive packages) Node's
 * `crypto`. The aliases below provide browser equivalents, following the
 * official midnight-wallet-dapp template.
 */
export default defineConfig({
  define: {
    global: 'globalThis',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  resolve: {
    alias: {
      process: 'process/browser',
      buffer: 'buffer',
      util: 'util',
      crypto: './src/crypto-shim.ts',
      stream: 'stream-browserify',
      events: 'events',
    },
  },
  plugins: [react(), wasm()],
  build: {
    // The ZK prover WASM and the contract bundle are large; keep chunks usable.
    chunkSizeWarningLimit: 4096,
  },
  server: {
    port: 5173,
  },
});
