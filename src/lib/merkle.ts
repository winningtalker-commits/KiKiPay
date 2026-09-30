/**
 * Off-chain mirror of the KiKiPay membership tree (browser port of
 * cli/merkle.ts). Builds a fixed-depth-4 Merkle tree over member secrets
 * using the SAME compiled pure circuits the on-chain proofs use
 * (leafFor / hashBranch / rootFrom), so roots and authentication paths
 * computed here are byte-for-byte what the circuits expect.
 */
import { pureCircuits } from '../../contracts/managed/kikipay/contract/index.js';

export const TREE_DEPTH = 4;
export const TREE_LEAVES = 1 << TREE_DEPTH; // 16 members max

export interface MerkleMember {
  /** The member's secret key (PRIVATE — never rendered, never logged). */
  secret: Uint8Array;
  /** H(leaf-domain || secret) — the leaf hash. */
  leaf: Uint8Array;
  /** Authentication path: sibling hash at each level (length 4). */
  path: Uint8Array[];
  /** True when the member's node is the RIGHT child at that level. */
  side: boolean[];
}

export interface MerkleTree {
  root: Uint8Array;
  members: MerkleMember[];
}

/** utf8 → left-padded 32-byte array (Compact's pad(32, ...)). */
export function bytes32(text: string): Uint8Array {
  const raw = new TextEncoder().encode(text);
  if (raw.length > 32) throw new Error(`"${text}" longer than 32 bytes`);
  const out = new Uint8Array(32);
  out.set(raw, 0);
  return out;
}

/** Deterministic demo secret derivation (client-side only). */
export function deriveSecret(seed: number): Uint8Array {
  const s = new Uint8Array(32);
  for (let i = 0; i < 32; i++) s[i] = (seed * 31 + i * 7 + 11) % 256;
  return s;
}

/**
 * Build the tree. The member list is padded with zero-secret placeholder
 * leaves up to 16, matching the circuit's fixed Vector<4> depth.
 */
export function buildMemberTree(secrets: Uint8Array[]): MerkleTree {
  if (secrets.length > TREE_LEAVES) {
    throw new Error(`max ${TREE_LEAVES} members in a depth-${TREE_DEPTH} tree`);
  }
  const padded = [...secrets];
  while (padded.length < TREE_LEAVES) padded.push(new Uint8Array(32));

  const members: MerkleMember[] = secrets.map((s) => ({
    secret: s,
    leaf: pureCircuits.leafFor(s),
    path: [],
    side: [],
  }));

  interface Node {
    hash: Uint8Array;
    subtree: MerkleMember[];
  }
  let nodes: Node[] = padded.map((s, i) => ({
    hash: pureCircuits.leafFor(s),
    subtree: i < secrets.length ? [members[i]] : [],
  }));

  while (nodes.length > 1) {
    const next: Node[] = [];
    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i];
      const right = nodes[i + 1];
      const hash = pureCircuits.hashBranch(left.hash, right.hash);
      for (const m of left.subtree) {
        m.path.push(right.hash);
        m.side.push(false);
      }
      for (const m of right.subtree) {
        m.path.push(left.hash);
        m.side.push(true);
      }
      next.push({ hash, subtree: [...left.subtree, ...right.subtree] });
    }
    nodes = next;
  }
  return { root: nodes[0].hash, members };
}

export const toHex = (b: Uint8Array): string =>
  Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export const shortHex = (b: Uint8Array, n = 12): string =>
  `${toHex(b).slice(0, n)}…`;
