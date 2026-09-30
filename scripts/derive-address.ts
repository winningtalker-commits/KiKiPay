/**
 * Print the demo relay wallet's funding address WITHOUT syncing (fast).
 * Same derivation path scripts/wallet-address.ts uses.
 *
 *   npx tsx scripts/derive-address.ts
 */
import { Buffer } from 'buffer';
import { getOrCreateWallet } from '../cli/network';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { HDWallet, Roles, createKeystore } from '@midnight-ntwrk/wallet-sdk';

const { seed } = getOrCreateWallet('preprod');
setNetworkId('preprod');

const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
if (hdWallet.type !== 'seedOk') throw new Error('Invalid seed');
const result = hdWallet.hdWallet
  .selectAccount(0)
  .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
  .deriveKeysAt(0);
if (result.type !== 'keysDerived') throw new Error('Key derivation failed');
hdWallet.hdWallet.clear();

const keystore = createKeystore(result.keys[Roles.NightExternal], 'preprod');
console.log(keystore.getBech32Address().toString());
