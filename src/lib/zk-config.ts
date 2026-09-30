/**
 * Browser ZKConfigProvider — serves the compiled ZK assets (prover key,
 * verifier key, bzkir) from the static /contract/… paths Vite copies into
 * the build. Mirrors NodeZkConfigProvider's layout:
 *   {base}/keys/{circuit}.prover | .verifier   and   {base}/zkir/{circuit}.bzkir
 *
 * Consumers:
 *  - httpClientProofProvider(url, this)  → embeds key material per request
 *  - the wallet's getProvingProvider(this) → Lace proves with these keys
 */
import {
  ZKConfigProvider,
  createProverKey,
  createVerifierKey,
  createZKIR,
} from '@midnight-ntwrk/midnight-js-types';
import { ZK_ASSETS_BASE } from './midnight';

async function fetchAsset(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ZK asset ${url}: ${res.status}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export class BrowserZkConfigProvider extends ZKConfigProvider<string> {
  readonly base: string;

  constructor(base: string = ZK_ASSETS_BASE) {
    super();
    this.base = base.replace(/\/$/, '');
  }

  getProverKey(circuitId: string): Promise<ReturnType<typeof createProverKey>> {
    return fetchAsset(`${this.base}/keys/${circuitId}.prover`).then((b) =>
      createProverKey(b),
    );
  }

  getVerifierKey(circuitId: string): Promise<ReturnType<typeof createVerifierKey>> {
    return fetchAsset(`${this.base}/keys/${circuitId}.verifier`).then((b) =>
      createVerifierKey(b),
    );
  }

  getZKIR(circuitId: string): Promise<ReturnType<typeof createZKIR>> {
    return fetchAsset(`${this.base}/zkir/${circuitId}.bzkir`).then((b) =>
      createZKIR(b),
    );
  }
}
