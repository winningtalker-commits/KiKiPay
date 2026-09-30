import * as __compactRuntime from '@midnight-ntwrk/compact-runtime';
__compactRuntime.checkRuntimeVersion('0.16.0');

const _descriptor_0 = new __compactRuntime.CompactTypeBytes(32);

const _descriptor_1 = new __compactRuntime.CompactTypeUnsignedInteger(65535n, 2);

const _descriptor_2 = new __compactRuntime.CompactTypeUnsignedInteger(18446744073709551615n, 8);

const _descriptor_3 = new __compactRuntime.CompactTypeVector(4, _descriptor_0);

const _descriptor_4 = __compactRuntime.CompactTypeBoolean;

const _descriptor_5 = new __compactRuntime.CompactTypeVector(4, _descriptor_4);

const _descriptor_6 = new __compactRuntime.CompactTypeVector(2, _descriptor_0);

const _descriptor_7 = new __compactRuntime.CompactTypeVector(3, _descriptor_0);

class _Either_0 {
  alignment() {
    return _descriptor_4.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment()));
  }
  fromValue(value_0) {
    return {
      is_left: _descriptor_4.fromValue(value_0),
      left: _descriptor_0.fromValue(value_0),
      right: _descriptor_0.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_4.toValue(value_0.is_left).concat(_descriptor_0.toValue(value_0.left).concat(_descriptor_0.toValue(value_0.right)));
  }
}

const _descriptor_8 = new _Either_0();

const _descriptor_9 = new __compactRuntime.CompactTypeUnsignedInteger(340282366920938463463374607431768211455n, 16);

class _ContractAddress_0 {
  alignment() {
    return _descriptor_0.alignment();
  }
  fromValue(value_0) {
    return {
      bytes: _descriptor_0.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_0.toValue(value_0.bytes);
  }
}

const _descriptor_10 = new _ContractAddress_0();

const _descriptor_11 = new __compactRuntime.CompactTypeUnsignedInteger(255n, 1);

export class Contract {
  witnesses;
  constructor(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract constructor: expected 1 argument, received ${args_0.length}`);
    }
    const witnesses_0 = args_0[0];
    if (typeof(witnesses_0) !== 'object') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor is not an object');
    }
    if (typeof(witnesses_0.paymasterSecret) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named paymasterSecret');
    }
    if (typeof(witnesses_0.payeeMemberSecret) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named payeeMemberSecret');
    }
    if (typeof(witnesses_0.payeeProofPath) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named payeeProofPath');
    }
    if (typeof(witnesses_0.payeeSideBits) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named payeeSideBits');
    }
    if (typeof(witnesses_0.paymentAmount) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named paymentAmount');
    }
    this.witnesses = witnesses_0;
    this.circuits = {
      leafFor(context, ...args_1) {
        return { result: pureCircuits.leafFor(...args_1), context };
      },
      hashBranch(context, ...args_1) {
        return { result: pureCircuits.hashBranch(...args_1), context };
      },
      rootFrom(context, ...args_1) {
        return { result: pureCircuits.rootFrom(...args_1), context };
      },
      publicCommit(context, ...args_1) {
        return { result: pureCircuits.publicCommit(...args_1), context };
      },
      paymentCommitment(context, ...args_1) {
        return { result: pureCircuits.paymentCommitment(...args_1), context };
      },
      registerPot: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`registerPot: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const newRoot_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('registerPot',
                                     'argument 1 (as invoked from Typescript)',
                                     'kikipay.compact line 162 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(newRoot_0.buffer instanceof ArrayBuffer && newRoot_0.BYTES_PER_ELEMENT === 1 && newRoot_0.length === 32)) {
          __compactRuntime.typeError('registerPot',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'kikipay.compact line 162 char 1',
                                     'Bytes<32>',
                                     newRoot_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(newRoot_0),
            alignment: _descriptor_0.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._registerPot_0(context,
                                             partialProofData,
                                             newRoot_0);
        partialProofData.output = { value: _descriptor_0.toValue(result_0), alignment: _descriptor_0.alignment() };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      rotatePot: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`rotatePot: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const newRoot_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('rotatePot',
                                     'argument 1 (as invoked from Typescript)',
                                     'kikipay.compact line 179 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(newRoot_0.buffer instanceof ArrayBuffer && newRoot_0.BYTES_PER_ELEMENT === 1 && newRoot_0.length === 32)) {
          __compactRuntime.typeError('rotatePot',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'kikipay.compact line 179 char 1',
                                     'Bytes<32>',
                                     newRoot_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(newRoot_0),
            alignment: _descriptor_0.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._rotatePot_0(context, partialProofData, newRoot_0);
        partialProofData.output = { value: _descriptor_0.toValue(result_0), alignment: _descriptor_0.alignment() };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      pay: (...args_1) => {
        if (args_1.length !== 1) {
          throw new __compactRuntime.CompactError(`pay: expected 1 argument (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('pay',
                                     'argument 1 (as invoked from Typescript)',
                                     'kikipay.compact line 198 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: { value: [], alignment: [] },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._pay_0(context, partialProofData);
        partialProofData.output = { value: _descriptor_0.toValue(result_0), alignment: _descriptor_0.alignment() };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      }
    };
    this.impureCircuits = {
      registerPot: this.circuits.registerPot,
      rotatePot: this.circuits.rotatePot,
      pay: this.circuits.pay
    };
    this.provableCircuits = {
      registerPot: this.circuits.registerPot,
      rotatePot: this.circuits.rotatePot,
      pay: this.circuits.pay
    };
  }
  initialState(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const constructorContext_0 = args_0[0];
    if (typeof(constructorContext_0) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'constructorContext' in argument 1 (as invoked from Typescript) to be an object`);
    }
    if (!('initialPrivateState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialPrivateState' in argument 1 (as invoked from Typescript)`);
    }
    if (!('initialZswapLocalState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript)`);
    }
    if (typeof(constructorContext_0.initialZswapLocalState) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript) to be an object`);
    }
    const state_0 = new __compactRuntime.ContractState();
    let stateValue_0 = __compactRuntime.StateValue.newArray();
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    state_0.data = new __compactRuntime.ChargedState(stateValue_0);
    state_0.setOperation('registerPot', new __compactRuntime.ContractOperation());
    state_0.setOperation('rotatePot', new __compactRuntime.ContractOperation());
    state_0.setOperation('pay', new __compactRuntime.ContractOperation());
    const context = __compactRuntime.createCircuitContext(__compactRuntime.dummyContractAddress(), constructorContext_0.initialZswapLocalState.coinPublicKey, state_0.data, constructorContext_0.initialPrivateState);
    const partialProofData = {
      input: { value: [], alignment: [] },
      output: undefined,
      publicTranscript: [],
      privateTranscriptOutputs: []
    };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_11.toValue(0n),
                                                                                              alignment: _descriptor_11.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(new Uint8Array(32)),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_11.toValue(1n),
                                                                                              alignment: _descriptor_11.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(new Uint8Array(32)),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_11.toValue(2n),
                                                                                              alignment: _descriptor_11.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(new Uint8Array(32)),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_11.toValue(3n),
                                                                                              alignment: _descriptor_11.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(0n),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_11.toValue(0n),
                                                                                              alignment: _descriptor_11.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(new Uint8Array([107, 105, 107, 105, 112, 97, 121, 58, 101, 109, 112, 116, 121, 45, 112, 111, 116, 45, 114, 111, 111, 116, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_11.toValue(1n),
                                                                                              alignment: _descriptor_11.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(new Uint8Array([107, 105, 107, 105, 112, 97, 121, 58, 117, 110, 115, 101, 116, 45, 112, 97, 121, 109, 97, 115, 116, 101, 114, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_11.toValue(2n),
                                                                                              alignment: _descriptor_11.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(new Uint8Array([107, 105, 107, 105, 112, 97, 121, 58, 110, 111, 45, 112, 97, 121, 109, 101, 110, 116, 45, 121, 101, 116, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    state_0.data = new __compactRuntime.ChargedState(context.currentQueryContext.state.state);
    return {
      currentContractState: state_0,
      currentPrivateState: context.currentPrivateState,
      currentZswapLocalState: context.currentZswapLocalState
    }
  }
  _persistentHash_0(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_6, value_0);
    return result_0;
  }
  _persistentHash_1(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_7, value_0);
    return result_0;
  }
  _paymasterSecret_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.paymasterSecret(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('paymasterSecret',
                                 'return value',
                                 'kikipay.compact line 86 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_0.toValue(result_0),
      alignment: _descriptor_0.alignment()
    });
    return result_0;
  }
  _payeeMemberSecret_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.payeeMemberSecret(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('payeeMemberSecret',
                                 'return value',
                                 'kikipay.compact line 89 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_0.toValue(result_0),
      alignment: _descriptor_0.alignment()
    });
    return result_0;
  }
  _payeeProofPath_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.payeeProofPath(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(Array.isArray(result_0) && result_0.length === 4 && result_0.every((t) => t.buffer instanceof ArrayBuffer && t.BYTES_PER_ELEMENT === 1 && t.length === 32))) {
      __compactRuntime.typeError('payeeProofPath',
                                 'return value',
                                 'kikipay.compact line 92 char 1',
                                 'Vector<4, Bytes<32>>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_3.toValue(result_0),
      alignment: _descriptor_3.alignment()
    });
    return result_0;
  }
  _payeeSideBits_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.payeeSideBits(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(Array.isArray(result_0) && result_0.length === 4 && result_0.every((t) => typeof(t) === 'boolean'))) {
      __compactRuntime.typeError('payeeSideBits',
                                 'return value',
                                 'kikipay.compact line 96 char 1',
                                 'Vector<4, Boolean>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_5.toValue(result_0),
      alignment: _descriptor_5.alignment()
    });
    return result_0;
  }
  _paymentAmount_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.paymentAmount(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0n && result_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('paymentAmount',
                                 'return value',
                                 'kikipay.compact line 100 char 1',
                                 'Uint<0..18446744073709551616>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_2.toValue(result_0),
      alignment: _descriptor_2.alignment()
    });
    return result_0;
  }
  _leafFor_0(secret_0) {
    return this._persistentHash_0([new Uint8Array([107, 105, 107, 105, 112, 97, 121, 58, 108, 101, 97, 102, 58, 118, 49, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   secret_0]);
  }
  _hashBranch_0(a_0, b_0) { return this._persistentHash_0([a_0, b_0]); }
  _merge_0(acc_0, sib_0, side_0) {
    if (side_0) {
      return this._hashBranch_0(sib_0, acc_0);
    } else {
      return this._hashBranch_0(acc_0, sib_0);
    }
  }
  _rootFrom_0(leaf_0, path_0, side_0) {
    const l0_0 = this._merge_0(leaf_0, path_0[0], side_0[0]);
    const l1_0 = this._merge_0(l0_0, path_0[1], side_0[1]);
    const l2_0 = this._merge_0(l1_0, path_0[2], side_0[2]);
    return this._merge_0(l2_0, path_0[3], side_0[3]);
  }
  _publicCommit_0(secret_0) {
    return this._persistentHash_0([new Uint8Array([107, 105, 107, 105, 112, 97, 121, 58, 112, 117, 98, 45, 99, 111, 109, 109, 105, 116, 58, 118, 49, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   secret_0]);
  }
  _paymentCommitment_0(payeeSecret_0, amount_0) {
    return this._persistentHash_1([new Uint8Array([107, 105, 107, 105, 112, 97, 121, 58, 112, 97, 121, 109, 101, 110, 116, 58, 118, 49, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   this._leafFor_0(payeeSecret_0),
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        amount_0,
                                                                        'kikipay.compact line 150 char 5')]);
  }
  _registerPot_0(context, partialProofData, newRoot_0) {
    const secret_0 = this._paymasterSecret_0(context, partialProofData);
    const path_0 = this._payeeProofPath_0(context, partialProofData);
    const side_0 = this._payeeSideBits_0(context, partialProofData);
    __compactRuntime.assert(this._equal_0(_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                    partialProofData,
                                                                                                    [
                                                                                                     { dup: { n: 0 } },
                                                                                                     { idx: { cached: false,
                                                                                                              pushPath: false,
                                                                                                              path: [
                                                                                                                     { tag: 'value',
                                                                                                                       value: { value: _descriptor_11.toValue(0n),
                                                                                                                                alignment: _descriptor_11.alignment() } }] } },
                                                                                                     { popeq: { cached: false,
                                                                                                                result: undefined } }]).value),
                                          new Uint8Array([107, 105, 107, 105, 112, 97, 121, 58, 101, 109, 112, 116, 121, 45, 112, 111, 116, 45, 114, 111, 111, 116, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'pot already registered');
    __compactRuntime.assert(this._equal_1(this._rootFrom_0(this._leafFor_0(secret_0),
                                                           path_0,
                                                           side_0),
                                          newRoot_0),
                            'registrar is not a member of the new pot');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_11.toValue(0n),
                                                                                              alignment: _descriptor_11.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(newRoot_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    const binding_0 = this._publicCommit_0(secret_0);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_11.toValue(1n),
                                                                                              alignment: _descriptor_11.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(binding_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    return binding_0;
  }
  _rotatePot_0(context, partialProofData, newRoot_0) {
    const secret_0 = this._paymasterSecret_0(context, partialProofData);
    const path_0 = this._payeeProofPath_0(context, partialProofData);
    const side_0 = this._payeeSideBits_0(context, partialProofData);
    __compactRuntime.assert(this._equal_2(this._publicCommit_0(secret_0),
                                          _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                    partialProofData,
                                                                                                    [
                                                                                                     { dup: { n: 0 } },
                                                                                                     { idx: { cached: false,
                                                                                                              pushPath: false,
                                                                                                              path: [
                                                                                                                     { tag: 'value',
                                                                                                                       value: { value: _descriptor_11.toValue(1n),
                                                                                                                                alignment: _descriptor_11.alignment() } }] } },
                                                                                                     { popeq: { cached: false,
                                                                                                                result: undefined } }]).value)),
                            'only the current paymaster can rotate the pot');
    __compactRuntime.assert(this._equal_3(this._rootFrom_0(this._leafFor_0(secret_0),
                                                           path_0,
                                                           side_0),
                                          newRoot_0),
                            'rotator is not a member of the new pot');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_11.toValue(0n),
                                                                                              alignment: _descriptor_11.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(newRoot_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    const binding_0 = this._publicCommit_0(secret_0);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_11.toValue(1n),
                                                                                              alignment: _descriptor_11.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(binding_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    return binding_0;
  }
  _pay_0(context, partialProofData) {
    const pmSecret_0 = this._paymasterSecret_0(context, partialProofData);
    const payeeSecret_0 = this._payeeMemberSecret_0(context, partialProofData);
    const path_0 = this._payeeProofPath_0(context, partialProofData);
    const side_0 = this._payeeSideBits_0(context, partialProofData);
    const amount_0 = this._paymentAmount_0(context, partialProofData);
    __compactRuntime.assert(this._equal_4(this._publicCommit_0(pmSecret_0),
                                          _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                    partialProofData,
                                                                                                    [
                                                                                                     { dup: { n: 0 } },
                                                                                                     { idx: { cached: false,
                                                                                                              pushPath: false,
                                                                                                              path: [
                                                                                                                     { tag: 'value',
                                                                                                                       value: { value: _descriptor_11.toValue(1n),
                                                                                                                                alignment: _descriptor_11.alignment() } }] } },
                                                                                                     { popeq: { cached: false,
                                                                                                                result: undefined } }]).value)),
                            'only the current paymaster can authorize payments');
    __compactRuntime.assert(this._equal_5(this._rootFrom_0(this._leafFor_0(payeeSecret_0),
                                                           path_0,
                                                           side_0),
                                          _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                    partialProofData,
                                                                                                    [
                                                                                                     { dup: { n: 0 } },
                                                                                                     { idx: { cached: false,
                                                                                                              pushPath: false,
                                                                                                              path: [
                                                                                                                     { tag: 'value',
                                                                                                                       value: { value: _descriptor_11.toValue(0n),
                                                                                                                                alignment: _descriptor_11.alignment() } }] } },
                                                                                                     { popeq: { cached: false,
                                                                                                                result: undefined } }]).value)),
                            'payee is not an approved member');
    __compactRuntime.assert(amount_0 > 0n, 'payment amount must be positive');
    const commitment_0 = this._paymentCommitment_0(payeeSecret_0, amount_0);
    const tmp_0 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_11.toValue(3n),
                                                                  alignment: _descriptor_11.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_1.toValue(tmp_0),
                                                                alignment: _descriptor_1.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_11.toValue(2n),
                                                                                              alignment: _descriptor_11.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(commitment_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    return commitment_0;
  }
  _equal_0(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_1(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_2(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_3(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_4(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_5(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
}
export function ledger(stateOrChargedState) {
  const state = stateOrChargedState instanceof __compactRuntime.StateValue ? stateOrChargedState : stateOrChargedState.state;
  const chargedState = stateOrChargedState instanceof __compactRuntime.StateValue ? new __compactRuntime.ChargedState(stateOrChargedState) : stateOrChargedState;
  const context = {
    currentQueryContext: new __compactRuntime.QueryContext(chargedState, __compactRuntime.dummyContractAddress()),
    costModel: __compactRuntime.CostModel.initialCostModel()
  };
  const partialProofData = {
    input: { value: [], alignment: [] },
    output: undefined,
    publicTranscript: [],
    privateTranscriptOutputs: []
  };
  return {
    get potRoot() {
      return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_11.toValue(0n),
                                                                                                   alignment: _descriptor_11.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get paymaster() {
      return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_11.toValue(1n),
                                                                                                   alignment: _descriptor_11.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get lastPaymentCommitment() {
      return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_11.toValue(2n),
                                                                                                   alignment: _descriptor_11.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get paymentCount() {
      return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_11.toValue(3n),
                                                                                                   alignment: _descriptor_11.alignment() } }] } },
                                                                        { popeq: { cached: true,
                                                                                   result: undefined } }]).value);
    }
  };
}
const _emptyContext = {
  currentQueryContext: new __compactRuntime.QueryContext(new __compactRuntime.ContractState().data, __compactRuntime.dummyContractAddress())
};
const _dummyContract = new Contract({
  paymasterSecret: (...args) => undefined,
  payeeMemberSecret: (...args) => undefined,
  payeeProofPath: (...args) => undefined,
  payeeSideBits: (...args) => undefined,
  paymentAmount: (...args) => undefined
});
export const pureCircuits = {
  leafFor: (...args_0) => {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`leafFor: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const secret_0 = args_0[0];
    if (!(secret_0.buffer instanceof ArrayBuffer && secret_0.BYTES_PER_ELEMENT === 1 && secret_0.length === 32)) {
      __compactRuntime.typeError('leafFor',
                                 'argument 1',
                                 'kikipay.compact line 109 char 1',
                                 'Bytes<32>',
                                 secret_0)
    }
    return _dummyContract._leafFor_0(secret_0);
  },
  hashBranch: (...args_0) => {
    if (args_0.length !== 2) {
      throw new __compactRuntime.CompactError(`hashBranch: expected 2 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const a_0 = args_0[0];
    const b_0 = args_0[1];
    if (!(a_0.buffer instanceof ArrayBuffer && a_0.BYTES_PER_ELEMENT === 1 && a_0.length === 32)) {
      __compactRuntime.typeError('hashBranch',
                                 'argument 1',
                                 'kikipay.compact line 114 char 1',
                                 'Bytes<32>',
                                 a_0)
    }
    if (!(b_0.buffer instanceof ArrayBuffer && b_0.BYTES_PER_ELEMENT === 1 && b_0.length === 32)) {
      __compactRuntime.typeError('hashBranch',
                                 'argument 2',
                                 'kikipay.compact line 114 char 1',
                                 'Bytes<32>',
                                 b_0)
    }
    return _dummyContract._hashBranch_0(a_0, b_0);
  },
  rootFrom: (...args_0) => {
    if (args_0.length !== 3) {
      throw new __compactRuntime.CompactError(`rootFrom: expected 3 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const leaf_0 = args_0[0];
    const path_0 = args_0[1];
    const side_0 = args_0[2];
    if (!(leaf_0.buffer instanceof ArrayBuffer && leaf_0.BYTES_PER_ELEMENT === 1 && leaf_0.length === 32)) {
      __compactRuntime.typeError('rootFrom',
                                 'argument 1',
                                 'kikipay.compact line 130 char 1',
                                 'Bytes<32>',
                                 leaf_0)
    }
    if (!(Array.isArray(path_0) && path_0.length === 4 && path_0.every((t) => t.buffer instanceof ArrayBuffer && t.BYTES_PER_ELEMENT === 1 && t.length === 32))) {
      __compactRuntime.typeError('rootFrom',
                                 'argument 2',
                                 'kikipay.compact line 130 char 1',
                                 'Vector<4, Bytes<32>>',
                                 path_0)
    }
    if (!(Array.isArray(side_0) && side_0.length === 4 && side_0.every((t) => typeof(t) === 'boolean'))) {
      __compactRuntime.typeError('rootFrom',
                                 'argument 3',
                                 'kikipay.compact line 130 char 1',
                                 'Vector<4, Boolean>',
                                 side_0)
    }
    return _dummyContract._rootFrom_0(leaf_0, path_0, side_0);
  },
  publicCommit: (...args_0) => {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`publicCommit: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const secret_0 = args_0[0];
    if (!(secret_0.buffer instanceof ArrayBuffer && secret_0.BYTES_PER_ELEMENT === 1 && secret_0.length === 32)) {
      __compactRuntime.typeError('publicCommit',
                                 'argument 1',
                                 'kikipay.compact line 139 char 1',
                                 'Bytes<32>',
                                 secret_0)
    }
    return _dummyContract._publicCommit_0(secret_0);
  },
  paymentCommitment: (...args_0) => {
    if (args_0.length !== 2) {
      throw new __compactRuntime.CompactError(`paymentCommitment: expected 2 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const payeeSecret_0 = args_0[0];
    const amount_0 = args_0[1];
    if (!(payeeSecret_0.buffer instanceof ArrayBuffer && payeeSecret_0.BYTES_PER_ELEMENT === 1 && payeeSecret_0.length === 32)) {
      __compactRuntime.typeError('paymentCommitment',
                                 'argument 1',
                                 'kikipay.compact line 146 char 1',
                                 'Bytes<32>',
                                 payeeSecret_0)
    }
    if (!(typeof(amount_0) === 'bigint' && amount_0 >= 0n && amount_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('paymentCommitment',
                                 'argument 2',
                                 'kikipay.compact line 146 char 1',
                                 'Uint<0..18446744073709551616>',
                                 amount_0)
    }
    return _dummyContract._paymentCommitment_0(payeeSecret_0, amount_0);
  }
};
export const contractReferenceLocations =
  { tag: 'publicLedgerArray', indices: { } };
//# sourceMappingURL=index.js.map
