/**
 * useMidnight — the one hook that owns every Midnight integration concern:
 *
 *  1. wallet detection  — polls window.midnight (Lace injects there)
 *  2. connection        — dapp-connector enable() flow, with the error cases
 *                         the rubric calls out (not installed / rejected /
 *                         network mismatch) surfaced as typed states
 *  3. midnight-js glue  — builds the provider set the SDK needs from the
 *                         connected wallet + static ZK assets + the indexer
 *  4. proving           — delegates to the wallet's proof server when it
 *                         exposes one (getConfiguration().proverServerUri),
 *                         else falls back to VITE_PROOF_SERVER_URL
 *
 * Private member secrets / amounts live only in this module's closures and
 * are NEVER returned to React state — the UI can only show what the chain
 * would see anyway.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { createProofProvider } from '@midnight-ntwrk/midnight-js-types';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { findDeployedContract, type DeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import type {
  ConnectedAPI,
  Configuration,
} from '@midnight-ntwrk/dapp-connector-api';

import * as KikiPayContract from '../../contracts/managed/kikipay/contract/index.js';
import { witnesses, createKikiPayPrivateState, type KikiPayPrivateState } from '../../contracts/witnesses.js';
import { BrowserZkConfigProvider } from '../lib/zk-config';
import {
  bech32ToBytes,
  bytesToHex,
} from '../lib/address';
import {
  CONTRACT_ADDRESS,
  INDEXER_URL,
  INDEXER_WS_URL,
  KIKIPAY_NETWORK_ID,
  PROOF_SERVER_URL,
} from '../lib/midnight';

// ─── types ────────────────────────────────────────────────────────────────────

export type WalletStatus =
  | 'detecting'      // polling for window.midnight
  | 'no-wallet'      // no wallet extension installed
  | 'disconnected'   // wallet present, not connected
  | 'connecting'     // enable() in flight
  | 'connected'      // usable session
  | 'error';         // see error

export interface WalletError {
  kind: 'not-installed' | 'rejected' | 'network-mismatch' | 'unknown';
  message: string;
}

export interface WalletInfo {
  /** Bech32m shielded address, shown in the UI. */
  shieldedAddress: string;
  /** Hex coin public key (midnight-js wants hex). */
  coinPublicKey: string;
  /** Hex encryption public key. */
  encryptionPublicKey: string;
  /** Bech32m unshielded (transparent) address, shown in the UI. */
  unshieldedAddress: string;
  walletName: string;
}

export interface LedgerView {
  potRoot: string;
  paymaster: string;
  lastPaymentCommitment: string;
  paymentCount: number;
}

const ZERO32 = new Uint8Array(32);

const initialPrivateState = (): KikiPayPrivateState =>
  createKikiPayPrivateState(
    ZERO32,
    ZERO32,
    [ZERO32, ZERO32, ZERO32, ZERO32],
    [false, false, false, false],
    0n,
  );

// ─── the hook ─────────────────────────────────────────────────────────────────

export function useMidnight() {
  const [status, setStatus] = useState<WalletStatus>('detecting');
  const [error, setError] = useState<WalletError | null>(null);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);

  // Non-React refs: the live objects the call layer needs. Keeping them out of
  // state guarantees no re-render can ever snapshot keys into the DOM.
  const apiRef = useRef<ConnectedAPI | null>(null);
  const zkProviderRef = useRef<BrowserZkConfigProvider | null>(null);
  const walletInfoRef = useRef<WalletInfo | null>(null);
  // Typed loosely: the generic parameter of DeployedContract is the compiled
  // contract's circuit map, which comes from a dynamic module (see below).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contractRef = useRef<any>(null);

  const zkProvider = useMemo(() => new BrowserZkConfigProvider(), []);
  zkProviderRef.current = zkProvider;

  // ── 1. wallet detection ─────────────────────────────────────────────────────
  useEffect(() => {
    let attempts = 0;
    const poll = window.setInterval(() => {
      const api = (window as unknown as { midnight?: Record<string, unknown> })
        .midnight;
      if (api && Object.keys(api).length > 0) {
        window.clearInterval(poll);
        setStatus('disconnected');
      } else if (++attempts > 20) {
        window.clearInterval(poll);
        setStatus('no-wallet');
        setError({
          kind: 'not-installed',
          message:
            'No Midnight wallet detected. Install the Lace wallet extension (lace.io/midnight) and reload this page.',
        });
      }
    }, 250);
    return () => window.clearInterval(poll);
  }, []);

  // ── 2. connect / disconnect ─────────────────────────────────────────────────
  const connect = useCallback(async () => {
    const injected = (
      window as unknown as { midnight?: Record<string, ConnectedAPI> }
    ).midnight;
    if (!injected || Object.keys(injected).length === 0) {
      setStatus('error');
      setError({
        kind: 'not-installed',
        message: 'No Midnight wallet detected — install Lace and reload.',
      });
      return;
    }
    setStatus('connecting');
    setError(null);
    try {
      // Select Lace if present, else the first injected wallet.
      const laceKey =
        Object.keys(injected).find((k) => /lace/i.test(k)) ??
        Object.keys(injected)[0];
      // InitialAPI has connect(); ConnectedAPI (its result) does not — keep
      // the two apart so the network-mismatch path can't double-connect.
      const initialApi = injected[laceKey] as unknown as {
        name?: string;
        connect: (networkId: string) => Promise<ConnectedAPI>;
      };

      setNetworkId(KIKIPAY_NETWORK_ID);
      const conn: ConnectedAPI = await initialApi.connect(KIKIPAY_NETWORK_ID);

      // Network mismatch: the wallet may have answered for another network.
      const config: Configuration = await conn.getConfiguration();
      if (config.networkId !== KIKIPAY_NETWORK_ID) {
        setStatus('error');
        setError({
          kind: 'network-mismatch',
          message: `Wallet is on "${config.networkId}" but KiKiPay's contract lives on "${KIKIPAY_NETWORK_ID}". Switch the wallet network and retry.`,
        });
        return;
      }

      const [shielded, unshielded] = await Promise.all([
        conn.getShieldedAddresses(),
        conn.getUnshieldedAddress(),
      ]);

      const info: WalletInfo = {
        shieldedAddress: shielded.shieldedAddress,
        coinPublicKey: bytesToHex(bech32ToBytes(shielded.shieldedCoinPublicKey)),
        encryptionPublicKey: bytesToHex(
          bech32ToBytes(shielded.shieldedEncryptionPublicKey),
        ),
        unshieldedAddress: unshielded.unshieldedAddress,
        walletName: initialApi.name ?? laceKey,
      };

      apiRef.current = conn;
      walletInfoRef.current = info;
      setWallet(info);
      setStatus('connected');

      // Join the deployed contract in the background; the UI shows a
      // connecting state on the call panel until this resolves.
      void (async () => {
        try {
          // Proving strategy, best path first:
          //   1. delegate to the WALLET (Lace) — getProvingProvider hands the
          //      wallet our key material and it proves with its own
          //      infrastructure; the visitor needs nothing but the extension.
          //   2. fall back to an HTTP proof server (wallet-configured URI,
          //      else VITE_PROOF_SERVER_URL / local docker default).
          let proofProvider;
          try {
            const walletProver = await conn.getProvingProvider(
              zkProviderRef.current! as never,
            );
            proofProvider = createProofProvider(walletProver as never);
            console.info('[kikipay] proofs delegated to the wallet');
          } catch {
            const proofServer = config.proverServerUri ?? PROOF_SERVER_URL;
            proofProvider = httpClientProofProvider(
              proofServer,
              zkProviderRef.current!,
            );
            console.info(`[kikipay] proofs via proof server ${proofServer}`);
          }

          // Serialization helpers: midnight-js hands us ledger Transaction
          // objects; the DApp connector speaks hex strings of the same bytes
          // (same seam the official midnight-wallet-dapp walletAdapter uses).
          const toHex = (b: Uint8Array): string =>
            Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
          const fromHex = (h: string): Uint8Array => {
            const clean = h.startsWith('0x') ? h.slice(2) : h;
            const out = new Uint8Array(clean.length / 2);
            for (let i = 0; i < out.length; i++) {
              out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
            }
            return out;
          };

          const { Transaction } = await import(
            '@midnight-ntwrk/midnight-js-protocol/ledger'
          );

          const providers = {
            privateStateProvider: await levelPrivateStateProvider({
              privateStateStoreName: 'kikipay-dapp-state',
              accountId: info.unshieldedAddress,
              privateStoragePasswordProvider: () =>
                process.env.PRIVATE_STATE_PASSWORD?.trim() ||
                'kikipay-browser-local-only',
            }),
            publicDataProvider: indexerPublicDataProvider(
              INDEXER_URL,
              INDEXER_WS_URL,
            ),
            zkConfigProvider: zkProviderRef.current!,
            proofProvider,
            walletProvider: {
              // Unbound (proof-carrying, pre-binding) tx → wallet pays fees
              // and returns the sealed transaction, deserialized back to the
              // ledger object midnight-js expects.
              balanceTx: async (tx: { serialize(): Uint8Array }) => {
                const res = await conn.balanceUnsealedTransaction(
                  toHex(tx.serialize()),
                );
                return Transaction.deserialize(
                  'signature',
                  'proof',
                  'binding',
                  fromHex(res.tx),
                );
              },
              getCoinPublicKey: () => info.coinPublicKey,
              getEncryptionPublicKey: () => info.encryptionPublicKey,
            },
            midnightProvider: {
              // Finalized tx → wallet relays it to the network.
              submitTx: async (tx: {
                serialize(): Uint8Array;
                identifiers(): string[];
              }): Promise<string> => {
                await conn.submitTransaction(toHex(tx.serialize()));
                const [txId] = tx.identifiers();
                return txId ?? 'submitted';
              },
            },
          } as const;

          const deployed = await findDeployedContract(providers as never, {
            compiledContract: CompiledContract.make(
              'kikipay',
              KikiPayContract.Contract,
            ).pipe(
              CompiledContract.withWitnesses(witnesses),
              CompiledContract.withCompiledFileAssets(
                zkProviderRef.current!.base,
              ),
            ) as never,
            contractAddress: CONTRACT_ADDRESS,
            privateStateId: 'kikipayDappState',
            initialPrivateState: initialPrivateState(),
          });
          contractRef.current = deployed;
        } catch (e) {
          console.warn('[kikipay] contract join failed:', e);
        }
      })();
    } catch (e) {
      const err = e as Error;
      const rejected =
        /reject|denied|cancel/i.test(err?.message ?? '') ||
        (e as { code?: number })?.code === 4001;
      setStatus('error');
      setError(
        rejected
          ? { kind: 'rejected', message: 'Connection request was rejected in the wallet.' }
          : { kind: 'unknown', message: err?.message ?? 'Unknown wallet error' },
      );
    }
  }, []);

  const disconnect = useCallback(() => {
    apiRef.current = null;
    contractRef.current = null;
    walletInfoRef.current = null;
    setWallet(null);
    setStatus('disconnected');
    setError(null);
  }, []);

  const isContractReady = contractRef.current !== null;

  return {
    // wallet state
    status,
    error,
    wallet,
    connect,
    disconnect,
    // circuit-call plumbing (for useMidnightCircuitCall)
    zkProvider,
    getApi: () => apiRef.current,
    getWalletInfo: () => walletInfoRef.current,
    /** true once the background findDeployedContract has resolved */
    contractJoined: isContractReady,
    contractRef,
  };
}

export type UseMidnightReturn = ReturnType<typeof useMidnight>;
