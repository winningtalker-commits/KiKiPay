/**
 * Wallet address helpers: the DApp connector returns Bech32m-encoded keys
 * and addresses; midnight-js expects hex strings for CoinPublicKey /
 * EncryptionPublicKey.
 */
import { bech32m as bech32mCodec } from 'bech32';

/** 5-bit groups → 8-bit groups (BIP-173 convertbits, no padding). */
function convertBits(data: number[], from: number, to: number, pad: boolean): number[] {
  let acc = 0;
  let bits = 0;
  const ret: number[] = [];
  const maxv = (1 << to) - 1;
  for (const value of data) {
    if (value < 0 || value >> from !== 0) throw new Error('invalid bech32 data');
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits) ret.push((acc << (to - bits)) & maxv);
  } else if (bits >= from || (acc << (to - bits)) & maxv) {
    throw new Error('invalid bech32 padding');
  }
  return ret;
}

/** Bech32m string → raw bytes. */
export function bech32ToBytes(encoded: string): Uint8Array {
  const { words } = bech32mCodec.decode(encoded as `${string}1${string}`, 1023);
  return new Uint8Array(convertBits(words, 5, 8, false));
}

export const bytesToHex = (b: Uint8Array): string =>
  Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export const hexToBytes = (hex: string): Uint8Array => {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

/** Shorten an address for display: first 10 + … + last 8 characters. */
export const shortAddress = (a: string, head = 10, tail = 8): string =>
  a.length <= head + tail + 1 ? a : `${a.slice(0, head)}…${a.slice(-tail)}`;
