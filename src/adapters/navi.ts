/**
 * Navi DEX adapter.
 * Lending-integrated AMM.
 */

import { createAmmAdapter } from './base';

export const naviAdapter = createAmmAdapter('navi', {
  reserve0: 'available',
  reserve1: 'borrowed',
});
