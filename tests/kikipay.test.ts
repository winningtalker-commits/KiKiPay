/**
 * KiKiPay contract test suite.
 *
 * Runs the ACTUAL compiled circuits (contracts/managed/kikipay) through the
 * Compact runtime — no mocks, no stubs. The same code that executes on chain
 * is executed here, minus proof generation (which only wraps the same
 * circuits and is exercised again at deploy time by the proof server).
 *
 * Coverage map (challenge rubric):
 *   1. Circuit logic         — pure helpers (leafFor / hashBranch / rootFrom /
 *                              publicCommit / paymentCommitment) + negative
 *                              authorization paths (asserts fire).
 *   2. State transitions     — registerPot → pay → rotatePot through the
 *                              simulator, checking every ledger field.
 *   3. Privacy               — the public ledger contains ONLY commitments
 *                              and roots; no secret, path, side bit, or raw
 *                              amount is recoverable from ledger state.
 */
import { describe, expect, it } from 'vitest';
import {
  type CircuitContext,
  type ConstructorContext,
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import {
  Contract,
  type Ledger,
  ledger,
  pureCircuits,
} from '../contracts/managed/kikipay/contract/index.js';
import {
  createKikiPayPrivateState,
  witnesses,
  type KikiPayPrivateState,
} from '../contracts/witnesses.js';

// ---------------------------------------------------------------------------
// Merkle tree built off-chain — byte-for-byte identical to what the circuit
// computes (same persistentHash, same ordering, same side-bit semantics).
// Fixed depth of 4 → exactly 16 leaves, matching the circuit's Vector<4, ...>.
// ---------------------------------------------------------------------------

const DEPTH = 4;
const LEAVES = 1 << DEPTH; // 16

/** utf8 → left-padded 32-byte array (Compact's pad(32, ...)). */
function bytes32(text: string): Uint8Array {
  const raw = new TextEncoder().encode(text);
  if (raw.length > 32) throw new Error(`"${text}" longer than 32 bytes`);
  const out = new Uint8Array(32);
  out.set(raw, 0);
  return out;
}

function randomSecret(seed: number): Uint8Array {
  const s = new Uint8Array(32);
  for (let i = 0; i < 32; i++) s[i] = (seed * 31 + i * 7 + 11) % 256;
  return s;
}

interface Member {
  secret: Uint8Array;
  leaf: Uint8Array;
  /** Authentication path: sibling hash at each level (length 4). */
  path: Uint8Array[];
  /** True when the member's node is the RIGHT child at that level. */
  side: boolean[];
}

function buildTree(secrets: Uint8Array[]): { root: Uint8Array; members: Member[] } {
  if (secrets.length > LEAVES) throw new Error('too many members for a depth-4 tree');
  // Pad the member list with placeholder (zero-secret) leaves up to 16.
  const padded = [...secrets];
  while (padded.length < LEAVES) padded.push(new Uint8Array(32));

  const members: Member[] = secrets.map((s) => ({
    secret: s,
    leaf: pureCircuits.leafFor(s),
    path: [],
    side: [],
  }));

  // Each node tracks the real members under its subtree so that, when it is
  // combined, every one of them records the sibling hash + side at this level.
  interface Node {
    hash: Uint8Array;
    subtree: Member[];
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

// ---------------------------------------------------------------------------
// Simulator — drives the compiled Contract class exactly like the official
// example-counter contract simulator.
// ---------------------------------------------------------------------------

const EMPTY_POT = bytes32('kikipay:empty-pot-root');
const EMPTY_PM = bytes32('kikipay:unset-paymaster');
const NO_PAYMENT = bytes32('kikipay:no-payment-yet');

class KikiPaySimulator {
  contract!: Contract<KikiPayPrivateState>;
  circuitContext!: CircuitContext<KikiPayPrivateState>;

  static async create(initial: KikiPayPrivateState): Promise<KikiPaySimulator> {
    const sim = new KikiPaySimulator();
    sim.contract = new Contract<KikiPayPrivateState>(witnesses);
    const ctorContext: ConstructorContext<KikiPayPrivateState> = createConstructorContext(
      initial,
      '0'.repeat(64),
    );
    const constructed = await sim.contract.initialState(ctorContext);
    sim.circuitContext = createCircuitContext(
      'registerPot',
      sampleContractAddress(),
      constructed.currentZswapLocalState,
      constructed.currentContractState,
      initial,
    );
    return sim;
  }

  getLedger(): Ledger {
    return ledger(this.circuitContext.callContext.currentQueryContext.state);
  }

  getPrivateState(): KikiPayPrivateState {
    return this.circuitContext.callContext.currentPrivateState as KikiPayPrivateState;
  }

  private as(actor: KikiPayPrivateState): CircuitContext<KikiPayPrivateState> {
    return {
      ...this.circuitContext,
      callContext: {
        ...this.circuitContext.callContext,
        currentPrivateState: actor,
      },
    } as CircuitContext<KikiPayPrivateState>;
  }

  async registerPot(actor: KikiPayPrivateState, newRoot: Uint8Array) {
    const res = await this.contract.impureCircuits.registerPot(this.as(actor), newRoot);
    this.circuitContext = res.context;
    return res.result;
  }

  async rotatePot(actor: KikiPayPrivateState, newRoot: Uint8Array) {
    const res = await this.contract.impureCircuits.rotatePot(this.as(actor), newRoot);
    this.circuitContext = res.context;
    return res.result;
  }

  async pay(actor: KikiPayPrivateState) {
    const res = await this.contract.impureCircuits.pay(this.as(actor));
    this.circuitContext = res.context;
    return res.result;
  }
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const secrets = [randomSecret(1), randomSecret(2), randomSecret(3), randomSecret(4)];
const tree = buildTree(secrets);
const [alice, bob, carol, dave] = tree.members;

/** State where alice (paymaster) pays `payee` the given amount. */
function payState(
  payee: Member,
  amount: bigint,
  paymaster: Member = alice,
): KikiPayPrivateState {
  return createKikiPayPrivateState(
    paymaster.secret,
    payee.secret,
    payee.path,
    payee.side,
    amount,
  );
}

/** Setup state where `actor` registers a pot they are a member of. */
function setupState(actor: Member, treeRoot: Uint8Array, actorPath: Uint8Array[], actorSide: boolean[]): KikiPayPrivateState {
  void treeRoot;
  return createKikiPayPrivateState(actor.secret, actor.secret, actorPath, actorSide, 0n);
}

const pmSetup = setupState(alice, tree.root, alice.path, alice.side);

// ---------------------------------------------------------------------------
// 1. CIRCUIT LOGIC
// ---------------------------------------------------------------------------

describe('KiKiPay pure circuit logic', () => {
  it('derives deterministic, secret-dependent member leaves', () => {
    const l1 = pureCircuits.leafFor(secrets[0]);
    const l2 = pureCircuits.leafFor(secrets[0]);
    expect(Buffer.from(l1).equals(Buffer.from(l2))).toBe(true);
    expect(Buffer.from(pureCircuits.leafFor(secrets[1])).equals(Buffer.from(l1))).toBe(false);
  });

  it('merkle rootFrom reproduces the off-chain root (mixed side bits)', () => {
    const computed = pureCircuits.rootFrom(alice.leaf, alice.path, alice.side);
    expect(Buffer.from(computed).equals(Buffer.from(tree.root))).toBe(true);
    for (const m of tree.members) {
      const r = pureCircuits.rootFrom(m.leaf, m.path, m.side);
      expect(Buffer.from(r).equals(Buffer.from(tree.root))).toBe(true);
    }
  });

  it('rejects a tampered authentication path', () => {
    const badSide = [...alice.side];
    badSide[1] = !badSide[1];
    const r = pureCircuits.rootFrom(alice.leaf, alice.path, badSide);
    expect(Buffer.from(r).equals(Buffer.from(tree.root))).toBe(false);
  });

  it('binds the paymaster without exposing identity', () => {
    const c = pureCircuits.publicCommit(alice.secret);
    expect(Buffer.from(c).equals(Buffer.from(pureCircuits.publicCommit(alice.secret)))).toBe(true);
    expect(Buffer.from(c).equals(Buffer.from(alice.secret))).toBe(false);
    expect(Buffer.from(c).equals(Buffer.from(alice.leaf))).toBe(false);
  });

  it('computes hiding payment commitments bound to payee and amount', () => {
    const c1 = pureCircuits.paymentCommitment(bob.secret, 1_000n);
    const c2 = pureCircuits.paymentCommitment(bob.secret, 1_000n);
    const otherAmount = pureCircuits.paymentCommitment(bob.secret, 2_000n);
    const otherPayee = pureCircuits.paymentCommitment(carol.secret, 1_000n);
    expect(Buffer.from(c1).equals(Buffer.from(c2))).toBe(true);
    expect(Buffer.from(c1).equals(Buffer.from(otherAmount))).toBe(false);
    expect(Buffer.from(c1).equals(Buffer.from(otherPayee))).toBe(false);
    const raw = Buffer.from(c1).toString('hex');
    expect(raw).not.toContain(1_000n.toString(16));
  });
});

// ---------------------------------------------------------------------------
// 2. STATE TRANSITIONS
// ---------------------------------------------------------------------------

describe('KiKiPay ledger state transitions', () => {
  it('starts with constructor sentinels', async () => {
    const sim = await KikiPaySimulator.create(pmSetup);
    const l = sim.getLedger();
    expect(Buffer.from(l.potRoot).equals(Buffer.from(EMPTY_POT))).toBe(true);
    expect(Buffer.from(l.paymaster).equals(Buffer.from(EMPTY_PM))).toBe(true);
    expect(Buffer.from(l.lastPaymentCommitment).equals(Buffer.from(NO_PAYMENT))).toBe(true);
    expect(l.paymentCount).toBe(0n);
  });

  it('registerPot binds root + paymaster and refuses re-registration', async () => {
    const sim = await KikiPaySimulator.create(pmSetup);
    const binding = await sim.registerPot(pmSetup, tree.root);
    let l = sim.getLedger();
    expect(Buffer.from(l.potRoot).equals(Buffer.from(tree.root))).toBe(true);
    expect(Buffer.from(l.paymaster).equals(Buffer.from(binding))).toBe(true);
    expect(Buffer.from(binding).equals(Buffer.from(pureCircuits.publicCommit(alice.secret)))).toBe(true);

    await expect(sim.registerPot(pmSetup, tree.root)).rejects.toThrow(/pot already registered/);
    l = sim.getLedger();
    expect(Buffer.from(l.potRoot).equals(Buffer.from(tree.root))).toBe(true); // unchanged
  });

  it('pay executes only for the paymaster AND a proven member', async () => {
    const sim = await KikiPaySimulator.create(pmSetup);
    await sim.registerPot(pmSetup, tree.root);

    const commitment = await sim.pay(payState(bob, 1_000n));
    const l = sim.getLedger();
    expect(l.paymentCount).toBe(1n);
    expect(Buffer.from(l.lastPaymentCommitment).equals(Buffer.from(commitment))).toBe(true);
    expect(
      Buffer.from(commitment).equals(Buffer.from(pureCircuits.paymentCommitment(bob.secret, 1_000n))),
    ).toBe(true);

    // non-member cannot be paid
    const outsider = createKikiPayPrivateState(
      alice.secret,
      randomSecret(99),
      [new Uint8Array(32), new Uint8Array(32), new Uint8Array(32), new Uint8Array(32)],
      [false, false, false, false],
      500n,
    );
    await expect(sim.pay(outsider)).rejects.toThrow(/not an approved member/);
  });

  it('rejects a non-paymaster trying to pay', async () => {
    const sim = await KikiPaySimulator.create(pmSetup);
    await sim.registerPot(pmSetup, tree.root);
    // bob pretends to be the paymaster (his secret as pmSecret)
    const impostor = createKikiPayPrivateState(
      bob.secret,
      carol.secret,
      carol.path,
      carol.side,
      1_000n,
    );
    await expect(sim.pay(impostor)).rejects.toThrow(/only the current paymaster/);
    expect(sim.getLedger().paymentCount).toBe(0n);
  });

  it('rotatePot swaps the member set under paymaster control', async () => {
    const sim = await KikiPaySimulator.create(pmSetup);
    await sim.registerPot(pmSetup, tree.root);

    const tree2 = buildTree([dave.secret, alice.secret]);
    const daveNode = tree2.members[0];
    const aliceNode2 = tree2.members[1];

    // non-paymaster cannot rotate
    const daveAsPm = createKikiPayPrivateState(
      dave.secret,
      dave.secret,
      daveNode.path,
      daveNode.side,
      0n,
    );
    await expect(sim.rotatePot(daveAsPm, tree2.root)).rejects.toThrow(/only the current paymaster/);

    // the paymaster — still a member of the NEW set — rotates successfully
    const pmInTree2 = createKikiPayPrivateState(
      alice.secret,
      alice.secret,
      aliceNode2.path,
      aliceNode2.side,
      0n,
    );
    const newBinding = await sim.rotatePot(pmInTree2, tree2.root);
    const l = sim.getLedger();
    expect(Buffer.from(l.potRoot).equals(Buffer.from(tree2.root))).toBe(true);
    expect(Buffer.from(l.paymaster).equals(Buffer.from(newBinding))).toBe(true);
    expect(Buffer.from(newBinding).equals(Buffer.from(pureCircuits.publicCommit(alice.secret)))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. PRIVACY — private inputs are never exposed
// ---------------------------------------------------------------------------

describe('KiKiPay privacy guarantees', () => {
  it('public ledger contains only commitments/roots — never secrets or amounts', async () => {
    const sim = await KikiPaySimulator.create(pmSetup);
    await sim.registerPot(pmSetup, tree.root);
    const AMOUNT = 777_000n;
    await sim.pay(payState(bob, AMOUNT));

    const l = sim.getLedger();
    const publicFields = [l.potRoot, l.paymaster, l.lastPaymentCommitment];

    for (const m of tree.members) {
      for (const pub of publicFields) {
        expect(Buffer.from(pub).equals(Buffer.from(m.secret))).toBe(false);
        expect(Buffer.from(pub).equals(Buffer.from(m.leaf))).toBe(false);
      }
    }
    // the raw amount's byte encoding is not present in any public field
    const amountBytes: string[] = [];
    let a = AMOUNT;
    while (a > 0n) {
      amountBytes.push((a & 0xffn).toString(16).padStart(2, '0'));
      a >>= 8n;
    }
    for (const pub of publicFields) {
      const hex = Buffer.from(pub).toString('hex');
      expect(hex.includes(amountBytes.join(''))).toBe(false);
    }
  });

  it('witness inputs never become ledger state', async () => {
    const sim = await KikiPaySimulator.create(pmSetup);
    await sim.registerPot(pmSetup, tree.root);
    const before = sim.getLedger();
    await sim.pay(payState(carol, 5_000n));
    const after = sim.getLedger();

    // the only fields that changed are the commitment + count; and neither
    // equals any secret/path material the witnesses supplied
    expect(after.paymentCount).toBe(before.paymentCount + 1n);
    for (const m of tree.members) {
      expect(Buffer.from(after.lastPaymentCommitment).equals(Buffer.from(m.secret))).toBe(false);
      for (const sib of m.path) {
        expect(Buffer.from(after.lastPaymentCommitment).equals(Buffer.from(sib))).toBe(false);
      }
    }
  });

  it('payment commitments are unlinkable across payees at the same amount', () => {
    const cBob = pureCircuits.paymentCommitment(bob.secret, 1_000n);
    const cCarol = pureCircuits.paymentCommitment(carol.secret, 1_000n);
    const cDave = pureCircuits.paymentCommitment(dave.secret, 1_000n);
    expect(Buffer.from(cBob).equals(Buffer.from(cCarol))).toBe(false);
    expect(Buffer.from(cCarol).equals(Buffer.from(cDave))).toBe(false);
    expect(Buffer.from(cBob).equals(Buffer.from(bob.leaf))).toBe(false);
  });

  it('an outsider cannot pass membership verification even with a guessed path', () => {
    const outsiderSecret = randomSecret(4242);
    const fakePath = [bytes32('fake1'), bytes32('fake2'), bytes32('fake3'), bytes32('fake4')];
    const r = pureCircuits.rootFrom(pureCircuits.leafFor(outsiderSecret), fakePath, [
      false,
      false,
      false,
      false,
    ]);
    expect(Buffer.from(r).equals(Buffer.from(tree.root))).toBe(false);
  });
});
