/**
 * Shio DEX adapter.
 * AMM pools.
 */

import { createAmmAdapter } from './base';

export const shioAdapter = createAmmAdapter('shio', {
  reserve0: 'reserve_a',
  reserve1: 'reserve_b',
});
