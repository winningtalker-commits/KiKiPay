/**
 * Browser global shims for the Node-first Midnight.js stack.
 * Imported FIRST in main.tsx so every later module sees them.
 */
import { Buffer } from 'buffer';

if (typeof (globalThis as { Buffer?: unknown }).Buffer === 'undefined') {
  (globalThis as { Buffer: unknown }).Buffer = Buffer;
}

if (
  typeof (globalThis as { process?: unknown }).process === 'undefined'
) {
  (globalThis as unknown as { process: unknown }).process = {
    env: {},
    browser: true,
    version: '',
    nextTick: (fn: (...args: unknown[]) => void, ...args: unknown[]) =>
      queueMicrotask(() => fn(...args)),
  };
}
