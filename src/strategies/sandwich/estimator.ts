/**
 * Sandwich profit estimation.
 * Uses AMM math to estimate profitability.
 */

import { simulateSandwich } from '../../math/amm';

/**
 * Estimate profit from sandwich given victim amount and pool state.
 */
export function estimateSandwichProfit(
  victimAmountIn: bigint,
  reserve0: bigint,
  reserve1: bigint,
  frontRunAmount: bigint,
  feeBps: number = 30
): bigint {
  const result = simulateSandwich(
    victimAmountIn,
    reserve0,
    reserve1,
    frontRunAmount,
    feeBps
  );
  return result.profit;
}

/**
 * Estimate optimal front-run size (simplified binary search).
 */
export function estimateOptimalFrontRun(
  victimAmountIn: bigint,
  reserve0: bigint,
  reserve1: bigint,
  feeBps: number = 30
): bigint {
  let low = victimAmountIn / 10n;
  let high = victimAmountIn;
  let best = 0n;
  let bestProfit = 0n;

  for (let i = 0; i < 32; i++) {
    const mid = (low + high) / 2n;
    const profit = estimateSandwichProfit(
      victimAmountIn,
      reserve0,
      reserve1,
      mid,
      feeBps
    );
    if (profit > bestProfit) {
      bestProfit = profit;
      best = mid;
    }
    if (profit > 0n) low = mid + 1n;
    else high = mid > 0n ? mid - 1n : 0n;
  }

  return best;
}
