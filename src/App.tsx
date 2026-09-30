import { useMidnight } from './hooks/useMidnight';
import { WalletConnect } from './components/WalletConnect';
import { CircuitCall } from './components/CircuitCall';
import { CONTRACT_ADDRESS } from './lib/midnight';
import { shortAddress } from './lib/address';

export default function App() {
  const midnight = useMidnight();

  return (
    <main className="shell">
      <header className="masthead">
        <div>
          <h1 className="logo">
            KiKi<span>Pay</span>
          </h1>
          <p className="tagline">
            Private payroll on Midnight — pay the pot without exposing who got
            paid, or how much.
          </p>
        </div>
        <a
          className="net-badge"
          href="https://docs.midnight.network/"
          target="_blank"
          rel="noreferrer"
        >
          Midnight · preprod
        </a>
      </header>

      <WalletConnect midnight={midnight} />
      <CircuitCall midnight={midnight} />

      <footer className="footer">
        <span className="mono small">
          contract {shortAddress(CONTRACT_ADDRESS, 12, 10)}
        </span>
        <span className="muted small">
          Proofs are generated in your browser; private inputs never leave it.
        </span>
      </footer>
    </main>
  );
}
