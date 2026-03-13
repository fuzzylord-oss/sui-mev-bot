/**
 * DeepBook DEX adapter.
 * Order book style (central limit order book).
 */

import { createAmmAdapter } from './base';

export const deepbookAdapter = createAmmAdapter('deepbook', {
  reserve0: 'base_reserve',
  reserve1: 'quote_reserve',
});
