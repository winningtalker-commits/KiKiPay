/**
 * One-off helper: create (or load) the per-network wallet and print its
 * funding address WITHOUT touching the network. Uses the project's own
 * network.ts / wallet.ts logic so the state file format matches deploy.ts,
 * and the printed address is exactly the one deploy.ts will wait on.
 *
 *   npx tsx scripts/wallet-address.ts --network preview
 */
import { Buffer } from 'buffer';
import {
  resolveNetwork,
  getOrCreateWallet,
  formatWalletBackupNotice,
  mnemonicToSeedHex,
} from '../cli/network';
import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import * as ledger from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { HDWallet, Roles, createKeystore } from '@midnight-ntwrk/wallet-sdk';

const argv = process.argv;
const flagIdx = argv.indexOf('--network');
const network = flagIdx >= 0 ? argv[flagIdx + 1] : undefined;
if (!network) {
  console.error('usage: npx tsx scripts/wallet-address.ts --network preview|preprod');
  process.exit(1);
}

const { network: resolved } = resolveNetwork({ argv: ['node', 'x', '--network', network] });
const wallet = getOrCreateWallet(resolved);
setNetworkId(resolved as any);

const notice = formatWalletBackupNotice(wallet, resolved);
if (notice) console.log(notice);

// Same derivation wallet.ts performs (BIP-39 seed → roles → keystore).
const seedHex = wallet.mnemonic ? mnemonicToSeedHex(wallet.mnemonic) : wallet.seed;
const hdWallet = HDWallet.fromSeed(Buffer.from(seedHex, 'hex'));
if (hdWallet.type !== 'seedOk') throw new Error('Invalid seed');
const result = hdWallet.hdWallet
  .selectAccount(0)
  .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
  .deriveKeysAt(0);
if (result.type !== 'keysDerived') throw new Error('Key derivation failed');
hdWallet.hdWallet.clear();

const keystore = createKeystore(result.keys[Roles.NightExternal], getNetworkId());
console.log('Network :', resolved);
console.log('Address :', keystore.getBech32Address().toString());
console.log('');
console.log('→ Fund at https://faucet.' + resolved + '.midnight.network, then run:');
console.log('    NODE_OPTIONS="--max-old-space-size=12288" npm run deploy -- --network ' + resolved);
