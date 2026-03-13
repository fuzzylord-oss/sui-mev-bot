/**
 * Abex DEX adapter.
 * CLMM pools.
 */

import { createAmmAdapter } from './base';

export const abexAdapter = createAmmAdapter('abex', {
  reserve0: 'reserve_0',
  reserve1: 'reserve_1',
});
