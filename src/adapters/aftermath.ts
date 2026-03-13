/**
 * Aftermath DEX adapter.
 * AMM pools with dynamic fees.
 */

import { createAmmAdapter } from './base';

export const aftermathAdapter = createAmmAdapter('aftermath', {
  reserve0: 'reserve_x',
  reserve1: 'reserve_y',
});
