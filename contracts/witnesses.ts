/**
 * KiKiPay witness implementations.
 *
 * Witnesses supply the PRIVATE inputs to the ZK circuits. Everything here
 * stays on the caller's machine: the Compact runtime uses these values while
 * generating the proof, but only the proof (and the circuit's public outputs)
 * ever reach the network.
 *
 * The private state is a plain object that the caller controls between
 * transactions — this is what makes multi-party simulation in tests possible
 * (each "actor" simply carries its own KikiPayPrivateState).
 *
 * NOTE on the Level 1 model: the pay circuit proves BOTH "the caller is the
 * paymaster" AND "the payee is a pot member", so the distributor's private
 * state carries the payee's member secret too (the sponsor selects
 * recipients). Self-service withdrawal by members is the Level 2 milestone.
 */
import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger, Witnesses } from './managed/kikipay/contract/index.js';

export interface KikiPayPrivateState {
  /** Secret key of the authorized distributor (the paymaster). */
  readonly paymasterSecret: Uint8Array;
  /** Secret key of the member being paid (or acting, for pot setup). */
  readonly payeeSecret: Uint8Array;
  /** Merkle authentication path for the payee's leaf (depth 4). */
  proofPath: Uint8Array[];
  /** Side bit per level: true when the payee's node is the RIGHT child. */
  sideBits: boolean[];
  /** Amount for the current payment (used by the pay circuit). */
  readonly paymentAmount: bigint;
}

export type KikiPayWitnesses = WitnessContext<Ledger, KikiPayPrivateState>;

export const witnesses: Witnesses<KikiPayPrivateState> = {
  paymasterSecret({ privateState }: KikiPayWitnesses): [KikiPayPrivateState, Uint8Array] {
    return [privateState, privateState.paymasterSecret];
  },

  payeeMemberSecret({ privateState }: KikiPayWitnesses): [KikiPayPrivateState, Uint8Array] {
    return [privateState, privateState.payeeSecret];
  },

  payeeProofPath({ privateState }: KikiPayWitnesses): [KikiPayPrivateState, Uint8Array[]] {
    return [privateState, privateState.proofPath];
  },

  payeeSideBits({ privateState }: KikiPayWitnesses): [KikiPayPrivateState, boolean[]] {
    return [privateState, privateState.sideBits];
  },

  paymentAmount({ privateState }: KikiPayWitnesses): [KikiPayPrivateState, bigint] {
    return [privateState, privateState.paymentAmount];
  },
};

/** Build an actor's private state. */
export function createKikiPayPrivateState(
  paymasterSecret: Uint8Array,
  payeeSecret: Uint8Array,
  proofPath: Uint8Array[] = [],
  sideBits: boolean[] = [false, false, false, false],
  paymentAmount = 0n,
): KikiPayPrivateState {
  return { paymasterSecret, payeeSecret, proofPath, sideBits, paymentAmount };
}
