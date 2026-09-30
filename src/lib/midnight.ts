/**
 * KiKiPay dApp constants + browser types.
 *
 * The deployed contract this frontend talks to is the Level 1 Preprod
 * deployment. Proof generation happens in the browser via the proof server
 * configured in the wallet (Lace), or the local dev server in development.
 */
import type { InitialAPI, ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

declare global {
  interface Window {
    /** Wallets (Lace) inject their DApp Connector API here. */
    midnight?: Record<string, InitialAPI>;
    cardano?: unknown;
  }
}

export type { InitialAPI, ConnectedAPI };

/** The network the Level 1 contract lives on. */
export const KIKIPAY_NETWORK_ID = 'preprod' as const;

/** Level 1 Preprod deployment (verified on-chain, see README). */
export const CONTRACT_ADDRESS =
  'cbeb5ef7cbb746840d83a10ddd7387e49488605b60ea4205a4cf3eb8450b1ca5';

/** Public indexer for read-only ledger queries (same endpoint the CLI uses). */
export const INDEXER_URL =
  'https://indexer.preprod.midnight.network/api/v4/graphql';
export const INDEXER_WS_URL =
  'wss://indexer.preprod.midnight.network/api/v4/graphql/ws';

/**
 * Proof server used when the wallet does not expose one of its own.
 * Defaults to the local dev server; in production set VITE_PROOF_SERVER_URL
 * to a publicly reachable Midnight proof server.
 */
export const PROOF_SERVER_URL =
  import.meta.env.VITE_PROOF_SERVER_URL ?? 'http://127.0.0.1:6300';

/** Where the compiled ZK assets (keys/zkir) are served from. */
export const ZK_ASSETS_BASE = '/contract/managed/kikipay';

/** Demo pot members. Secrets exist only in browser memory — never rendered. */
export const DEMO_MEMBERS = ['alice (paymaster)', 'bob', 'carol', 'dave'] as const;
