/**
 * FlowX DEX adapter.
 * CLMM (concentrated liquidity) pools.
 */

import { createAmmAdapter } from './base';

export const flowxAdapter = createAmmAdapter('flowx', {
  reserve0: 'liquidity',
  reserve1: 'sqrt_price',
});
