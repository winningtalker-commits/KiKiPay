#!/usr/bin/env node
/**
 * Copy the compiled ZK assets into public/ so Vite serves them to the browser
 * (the client-side prover fetches keys + bzkir from these static paths).
 *
 * Runs before `npm run dev` and `npm run build` via the predev/prebuild hooks.
 * public/contract is gitignored — it is pure derived data from contracts/managed.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'contracts', 'managed', 'kikipay');
const dest = join(root, 'public', 'contract', 'managed', 'kikipay');

if (!existsSync(src)) {
  console.error('contracts/managed/kikipay missing — run `npm run compile` first.');
  process.exit(1);
}

rmSync(join(root, 'public', 'contract'), { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
// Keys + zkir are fetched by the prover; contract/index.js is bundled by Vite.
cpSync(join(src, 'keys'), join(dest, 'keys'), { recursive: true });
cpSync(join(src, 'zkir'), join(dest, 'zkir'), { recursive: true });
console.log('ZK assets copied to public/contract/managed/kikipay');
