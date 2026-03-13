/**
 * BlueMove DEX adapter.
 * AMM-style pools on Sui mainnet.
 */

import { createAmmAdapter } from './base';

export const bluemoveAdapter = createAmmAdapter('bluemove', {
  reserve0: 'reserve_a',
  reserve1: 'reserve_b',
});
