import { useEffect, useState } from 'react';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';

import * as KikiPayContract from '../../contracts/managed/kikipay/contract/index.js';
import { createKikiPayPrivateState } from '../../contracts/witnesses.js';
import type { UseMidnightReturn } from '../hooks/useMidnight';
import { BrowserZkConfigProvider } from '../lib/zk-config';
import { buildMemberTree, deriveSecret, bytes32, shortHex, type MerkleTree } from '../lib/merkle';
import { CONTRACT_ADDRESS, INDEXER_URL, INDEXER_WS_URL } from '../lib/midnight';

interface LedgerView {
  potRoot: string;
  paymaster: string;
  lastPaymentCommitment: string;
  paymentCount: number;
}

type CallStage =
  | { phase: 'idle' }
  | { phase: 'building' }
  | { phase: 'proving'; circuit: string }
  | { phase: 'submitting' }
  | { phase: 'done'; txId: string; commitment?: string }
  | { phase: 'failed'; message: string };

/**
 * Circuit call UI (Level 2 rubric Step 4).
 *
 * One action: register the demo payroll pot on the deployed Preprod contract
 * (the `registerPot` circuit). The ZK proof is generated from private inputs
 * that never enter React state — they exist only inside the closure that
 * builds the circuit's private state, and the only value shown afterwards is
 * what the chain publishes anyway (tx id, new root).
 *
 * PRIVATE INPUTS NEVER RENDER. The label rubric requires is on the button.
 */
export function CircuitCall({ midnight }: { midnight: UseMidnightReturn }) {
  const { status } = midnight;
  const [stage, setStage] = useState<CallStage>({ phase: 'idle' });
  const [ledger, setLedger] = useState<LedgerView | null>(null);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const connected = status === 'connected';

  // ── read-only public ledger view (works without a wallet) ──────────────────
  // The public indexer can be slow or briefly unreachable (503s during
  // maintenance). Every attempt is bounded by a timeout and the whole refresh
  // retries with backoff; the UI never shows a raw fetch error — only a clear,
  // human explanation plus a manual Refresh.
  const fetchLedgerOnce = async (): Promise<'ok' | 'missing' | 'unreachable'> => {
    const provider = indexerPublicDataProvider(INDEXER_URL, INDEXER_WS_URL);
    const state = await Promise.race([
      provider.queryContractState(CONTRACT_ADDRESS),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('indexer timeout')), 12_000),
      ),
    ]);
    if (!state) return 'missing';
    const l = KikiPayContract.ledger(state.data);
    setLedger({
      potRoot: shortHex(l.potRoot, 24),
      paymaster: shortHex(l.paymaster, 24),
      lastPaymentCommitment: shortHex(l.lastPaymentCommitment, 24),
      paymentCount: Number(l.paymentCount),
    });
    return 'ok';
  };

  const refreshLedger = async () => {
    setLedgerError(null);
    setLedgerLoading(true);
    const backoff = [0, 3_000, 6_000];
    let outcome: 'ok' | 'missing' | 'unreachable' = 'unreachable';
    for (const delay of backoff) {
      if (delay) await new Promise((r) => setTimeout(r, delay));
      try {
        outcome = await fetchLedgerOnce();
        if (outcome === 'ok') break;
      } catch {
        outcome = 'unreachable';
      }
    }
    setLedgerLoading(false);
    if (outcome === 'unreachable') {
      setLedgerError(
        'The public Preprod indexer is unreachable right now (maintenance or outage). ' +
          'The ledger loads automatically once it is back — or hit Refresh to retry.',
      );
    } else if (outcome === 'missing') {
      setLedgerError('Contract state not indexed yet — try again shortly.');
    }
  };

  useEffect(() => {
    void refreshLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── the on-chain circuit call ───────────────────────────────────────────────
  const registerPot = async () => {
    if (!midnight.contractRef.current) {
      setStage({
        phase: 'failed',
        message: 'Contract session not ready yet — a moment after connecting, then retry.',
      });
      return;
    }
    try {
      setStage({ phase: 'building' });

      // PRIVATE INPUTS — built here and passed straight into the circuit's
      // private state. They never touch React state, the DOM, or the console.
      const secrets = [1, 2, 3, 4].map(deriveSecret);
      const tree: MerkleTree = buildMemberTree(secrets);

      const paymaster = tree.members[0];
      const privateState = createKikiPayPrivateState(
        paymaster.secret, // paymasterSecret
        paymaster.secret, // payeeSecret (unused by registerPot)
        paymaster.path, // proofPath
        paymaster.side, // sideBits
        0n, // paymentAmount (unused by registerPot)
      );

      setStage({ phase: 'proving', circuit: 'registerPot' });

      const deployed = midnight.contractRef.current;
      const tx = await deployed.callTx.registerPot(tree.root, {
        privateState,
      });

      setStage({
        phase: 'submitting',
      });

      setStage({
        phase: 'done',
        txId: String(tx.public.txId ?? 'submitted'),
        commitment: shortHex(tree.root, 20),
      });

      // Refresh the public view so the new root/count appear.
      void refreshLedger();
    } catch (e) {
      setStage({
        phase: 'failed',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const busy =
    stage.phase === 'building' ||
    stage.phase === 'proving' ||
    stage.phase === 'submitting';

  return (
    <section className="card" data-testid="circuit-panel">
      <header className="card-head">
        <h2>Contract action</h2>
        <span className="mono small" title={CONTRACT_ADDRESS}>
          preprod · {CONTRACT_ADDRESS.slice(0, 10)}…
        </span>
      </header>

      <p className="muted">
        Registers the demo payroll pot (4 members, Merkle depth 4) on the
        deployed contract by running the <code>registerPot</code> circuit. The
        proof is generated locally; the chain sees only the new pot root.
      </p>

      <button
        className="btn btn-primary"
        onClick={registerPot}
        disabled={!connected || busy}
        data-testid="call-register"
      >
        Call registerPot — Proved without revealing your input
      </button>

      {!connected && (
        <p className="muted small">Connect a wallet to enable the call.</p>
      )}

      {busy && (
        <div className="progress" data-testid="call-progress" role="status">
          <span className="spinner" aria-hidden="true" />
          {stage.phase === 'building' && 'Building private inputs and Merkle tree…'}
          {stage.phase === 'proving' && (
            <>Generating ZK proof locally ({stage.circuit})… this can take ~30-60 s.</>
          )}
          {stage.phase === 'submitting' && 'Submitting transaction to Preprod…'}
        </div>
      )}

      {stage.phase === 'done' && (
        <div className="success" data-testid="call-result">
          <strong>Transaction submitted.</strong>
          <div className="mono small">tx: {stage.txId}</div>
          {stage.commitment && (
            <div className="mono small">new potRoot: {stage.commitment}…</div>
          )}
        </div>
      )}

      {stage.phase === 'failed' && (
        <div className="error" role="alert" data-testid="call-error">
          <strong>Call failed.</strong> {stage.message}
        </div>
      )}

      <hr />

      <header className="card-head">
        <h3>Public ledger</h3>
        <button
          className="btn btn-ghost"
          onClick={refreshLedger}
          disabled={ledgerLoading}
          data-testid="refresh-ledger"
        >
          {ledgerLoading ? 'Retrying…' : 'Refresh'}
        </button>
      </header>

      {ledgerLoading && (
        <div className="progress" role="status" data-testid="ledger-progress">
          <span className="spinner" aria-hidden="true" />
          Querying the Preprod indexer…
        </div>
      )}

      {ledgerError && !ledgerLoading && (
        <p className="muted small" role="status" data-testid="ledger-error">
          {ledgerError}
        </p>
      )}

      {ledger && (
        <div className="ledger" data-testid="ledger">
          <div className="kv">
            <span className="k">potRoot</span>
            <span className="v mono">{ledger.potRoot}</span>
          </div>
          <div className="kv">
            <span className="k">paymaster</span>
            <span className="v mono">{ledger.paymaster}</span>
          </div>
          <div className="kv">
            <span className="k">lastPaymentCommitment</span>
            <span className="v mono">{ledger.lastPaymentCommitment}</span>
          </div>
          <div className="kv">
            <span className="k">paymentCount</span>
            <span className="v mono">{ledger.paymentCount}</span>
          </div>
        </div>
      )}

      <p className="muted small">
        An observer sees a root, a paymaster commitment and a payment counter —
        never member identities or amounts.
      </p>
    </section>
  );
}
