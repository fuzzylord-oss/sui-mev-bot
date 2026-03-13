/**
 * Cetus DEX adapter.
 * CLMM pools (Uniswap v3 style).
 */

import { createAmmAdapter } from './base';

export const cetusAdapter = createAmmAdapter('cetus', {
  reserve0: 'token_a_amount',
  reserve1: 'token_b_amount',
});
