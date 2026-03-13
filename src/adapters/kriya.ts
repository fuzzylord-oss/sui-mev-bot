/**
 * Kriya DEX adapter.
 * AMM and CLMM hybrid.
 */

import { createAmmAdapter } from './base';

export const kriyaAdapter = createAmmAdapter('kriya', {
  reserve0: 'base_reserve',
  reserve1: 'quote_reserve',
});
