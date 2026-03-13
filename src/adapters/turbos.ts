/**
 * Turbos DEX adapter.
 * CLMM pools on Sui.
 */

import { createAmmAdapter } from './base';

export const turbosAdapter = createAmmAdapter('turbos', {
  reserve0: 'amount_a',
  reserve1: 'amount_b',
});
