/**
 * Browser shim for Node's `crypto` import.
 *
 * Some transitive Midnight packages do `import crypto from 'crypto'`. In the
 * browser, randomness comes from the Web Crypto API (available as
 * `globalThis.crypto` in every secure context). Hashing and other primitives
 * are provided by the @noble packages the Midnight libraries bundle
 * themselves, so only the random-bytes surface needs shimming.
 */

const webcrypto: Crypto = globalThis.crypto;

const crypto = {
  webcrypto,
  getRandomValues<T extends ArrayBufferView>(array: T): T {
    webcrypto.getRandomValues(
      array as unknown as ArrayBufferView,
    );
    return array;
  },
  randomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    webcrypto.getRandomValues(bytes);
    return bytes;
  },
  randomUUID(): string {
    return webcrypto.randomUUID();
  },
};

export default crypto;
export { webcrypto };
