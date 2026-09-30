import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  paymasterSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  payeeMemberSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  payeeProofPath(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array[]];
  payeeSideBits(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, boolean[]];
  paymentAmount(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
}

export type ImpureCircuits<PS> = {
  registerPot(context: __compactRuntime.CircuitContext<PS>,
              newRoot_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  rotatePot(context: __compactRuntime.CircuitContext<PS>, newRoot_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  pay(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type ProvableCircuits<PS> = {
  registerPot(context: __compactRuntime.CircuitContext<PS>,
              newRoot_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  rotatePot(context: __compactRuntime.CircuitContext<PS>, newRoot_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  pay(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type PureCircuits = {
  leafFor(secret_0: Uint8Array): Uint8Array;
  hashBranch(a_0: Uint8Array, b_0: Uint8Array): Uint8Array;
  rootFrom(leaf_0: Uint8Array, path_0: Uint8Array[], side_0: boolean[]): Uint8Array;
  publicCommit(secret_0: Uint8Array): Uint8Array;
  paymentCommitment(payeeSecret_0: Uint8Array, amount_0: bigint): Uint8Array;
}

export type Circuits<PS> = {
  leafFor(context: __compactRuntime.CircuitContext<PS>, secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  hashBranch(context: __compactRuntime.CircuitContext<PS>,
             a_0: Uint8Array,
             b_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  rootFrom(context: __compactRuntime.CircuitContext<PS>,
           leaf_0: Uint8Array,
           path_0: Uint8Array[],
           side_0: boolean[]): __compactRuntime.CircuitResults<PS, Uint8Array>;
  publicCommit(context: __compactRuntime.CircuitContext<PS>,
               secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  paymentCommitment(context: __compactRuntime.CircuitContext<PS>,
                    payeeSecret_0: Uint8Array,
                    amount_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  registerPot(context: __compactRuntime.CircuitContext<PS>,
              newRoot_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  rotatePot(context: __compactRuntime.CircuitContext<PS>, newRoot_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  pay(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type Ledger = {
  readonly potRoot: Uint8Array;
  readonly paymaster: Uint8Array;
  readonly lastPaymentCommitment: Uint8Array;
  readonly paymentCount: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
