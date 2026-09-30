import { shortAddress } from '../lib/address';
import type { UseMidnightReturn } from '../hooks/useMidnight';

const STATUS_LABEL: Record<string, string> = {
  detecting: 'Looking for a Midnight wallet…',
  'no-wallet': 'No Midnight wallet found',
  disconnected: 'Wallet detected — not connected',
  connecting: 'Connecting…',
  connected: 'Connected',
  error: 'Connection problem',
};

/**
 * Wallet connect / disconnect UI (Level 2 rubric Step 3).
 *
 * Connected → shows the wallet's addresses.
 * Disconnected → clear call-to-action.
 * Errors → specific message for not-installed / rejected / network-mismatch.
 *
 * Receives the single `useMidnight()` instance from <App/> so the wallet and
 * circuit panels always see the same connection.
 */
export function WalletConnect({ midnight }: { midnight: UseMidnightReturn }) {
  const { status, error, wallet, connect, disconnect } = midnight;
  const busy = status === 'connecting' || status === 'detecting';

  return (
    <section className="card" data-testid="wallet-panel" aria-live="polite">
      <header className="card-head">
        <h2>Wallet</h2>
        <span className={`pill pill-${status}`} data-testid="wallet-status">
          {STATUS_LABEL[status] ?? status}
        </span>
      </header>

      {wallet ? (
        <div className="wallet-grid">
          <div className="kv">
            <span className="k">Wallet</span>
            <span className="v">{wallet.walletName}</span>
          </div>
          <div className="kv">
            <span className="k">Shielded address</span>
            <span className="v mono" title={wallet.shieldedAddress} data-testid="wallet-address">
              {shortAddress(wallet.shieldedAddress, 18, 10)}
            </span>
          </div>
          <div className="kv">
            <span className="k">Transparent address</span>
            <span className="v mono" title={wallet.unshieldedAddress}>
              {shortAddress(wallet.unshieldedAddress, 18, 10)}
            </span>
          </div>
          <button className="btn btn-secondary" onClick={disconnect} data-testid="disconnect">
            Disconnect
          </button>
        </div>
      ) : (
        <div className="wallet-grid">
          <p className="muted">
            Connect Lace to interact with the KiKiPay payroll pot. Connection
            requests are approved in the wallet; this page never sees your seed
            phrase.
          </p>
          <button
            className="btn btn-primary"
            onClick={connect}
            disabled={busy}
            data-testid="connect"
          >
            {status === 'connecting' ? 'Connecting…' : 'Connect Lace wallet'}
          </button>
        </div>
      )}

      {error && (
        <div className={`error error-${error.kind}`} role="alert" data-testid="wallet-error">
          {error.kind === 'not-installed' && (
            <>
              <strong>No wallet detected.</strong> Install the{' '}
              <a href="https://www.lace.io/midnight" target="_blank" rel="noreferrer">
                Lace wallet extension
              </a>{' '}
              and reload this page.
            </>
          )}
          {error.kind === 'rejected' && (
            <>
              <strong>Connection rejected.</strong> Approve the request in Lace
              and try again.
            </>
          )}
          {error.kind === 'network-mismatch' && (
            <>
              <strong>Wrong network.</strong> {error.message}
            </>
          )}
          {error.kind === 'unknown' && (
            <>
              <strong>Connection failed.</strong> {error.message}
            </>
          )}
        </div>
      )}
    </section>
  );
}
