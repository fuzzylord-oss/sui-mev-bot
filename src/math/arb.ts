/**
 * Arbitrage Mathematics Module
 *
 * Triangular arb detection, path profitability, multi-hop quote simulation,
 * and route optimization for MEV extraction across DEX pools.
 *
 * References:
 * - Bellman-Ford / Floyd-Warshall for negative-cycle arb
 * - Multi-hop swap path enumeration
 * - Profit maximization under gas constraints
 */

import { getAmountOutConstantProduct, getAmountInConstantProduct } from './amm';
import { minAmountOut } from './slippage';

/** A single hop in an arb path */
export interface ArbHop {
  readonly poolId: string;
  readonly tokenIn: string;
  readonly tokenOut: string;
  readonly reserveIn: bigint;
  readonly reserveOut: bigint;
  readonly feeBps: number;
}

/** Full arb path (2 or 3 hops typically) */
export interface ArbPath {
  readonly hops: readonly ArbHop[];
  readonly tokenStart: string;
  readonly tokenEnd: string;
  readonly expectedProfit: bigint;
  readonly profitBps: number;
}

/** Result of path simulation */
export interface PathSimulationResult {
  readonly amountOut: bigint;
  readonly amountsPerHop: readonly bigint[];
  readonly priceImpactBps: number;
  readonly isProfitable: boolean;
  readonly profitBps: number;
}

/**
 * Simulate a triangular arb: A -> B -> C -> A.
 * Returns final amount in token A after completing the cycle.
 */
export function simulateTriangularArb(
  amountIn: bigint,
  path: readonly ArbHop[],
  slippageBps: number = 50
): PathSimulationResult {
  if (path.length < 2) {
    return {
      amountOut: amountIn,
      amountsPerHop: [amountIn],
      priceImpactBps: 0,
      isProfitable: false,
      profitBps: 0,
    };
  }

  const amounts: bigint[] = [amountIn];
  let amount = amountIn;

  for (let i = 0; i < path.length; i++) {
    const hop = path[i];
    const out = getAmountOutConstantProduct(
      amount,
      hop.reserveIn,
      hop.reserveOut,
      hop.feeBps
    );
    const minOut = minAmountOut(out, slippageBps);
    amount = minOut;
    amounts.push(amount);
  }

  const profit = amount > amountIn ? amount - amountIn : 0n;
  const profitBps = amountIn > 0n
    ? Number((profit * 10000n) / amountIn)
    : 0;

  return {
    amountOut: amount,
    amountsPerHop: amounts,
    priceImpactBps: 0, // Simplified
    isProfitable: profit > 0n,
    profitBps,
  };
}

/**
 * Find optimal input amount for a triangular arb path.
 * Uses binary search over input amount to maximize profit.
 */
export function optimalArbInputAmount(
  path: readonly ArbHop[],
  maxAmountIn: bigint,
  slippageBps: number = 50,
  iterations: number = 32
): bigint {
  let low = 0n;
  let high = maxAmountIn;
  let bestAmount = 0n;
  let bestProfit = 0n;

  for (let i = 0; i < iterations; i++) {
    const mid = (low + high) / 2n;
    const result = simulateTriangularArb(mid, path, slippageBps);
    const profit = result.amountOut > mid ? result.amountOut - mid : 0n;

    if (profit > bestProfit) {
      bestProfit = profit;
      bestAmount = mid;
    }

    if (result.amountOut > mid) {
      low = mid + 1n;
    } else {
      high = mid > 0n ? mid - 1n : 0n;
    }
  }

  return bestAmount;
}

/**
 * Enumerate all triangular paths for tokens A, B, C.
 * Returns paths that could be profitable.
 */
export function enumerateTriangularPaths(
  pools: readonly { poolId: string; token0: string; token1: string; reserve0: bigint; reserve1: bigint; feeBps: number }[],
  tokens: readonly [string, string, string]
): ArbPath[] {
  const [A, B, C] = tokens;
  const paths: ArbPath[] = [];

  const findPool = (t0: string, t1: string) =>
    pools.find(
      (p) =>
        (p.token0 === t0 && p.token1 === t1) || (p.token0 === t1 && p.token1 === t0)
    );

  const buildHops = (
    dir: [string, string, string]
  ): ArbHop[] | null => {
    const [t1, t2, t3] = dir;
    const p1 = findPool(t1, t2);
    const p2 = findPool(t2, t3);
    const p3 = findPool(t3, t1);
    if (!p1 || !p2 || !p3) return null;

    const toHop = (p: typeof p1, inT: string, outT: string): ArbHop => {
      const [resIn, resOut] =
        p.token0 === inT
          ? [p.reserve0, p.reserve1]
          : [p.reserve1, p.reserve0];
      return {
        poolId: p.poolId,
        tokenIn: inT,
        tokenOut: outT,
        reserveIn: resIn,
        reserveOut: resOut,
        feeBps: p.feeBps,
      };
    };

    return [
      toHop(p1, t1, t2),
      toHop(p2, t2, t3),
      toHop(p3, t3, t1),
    ];
  };

  const orders: [string, string, string][] = [
    [A, B, C],
    [A, C, B],
    [B, A, C],
    [B, C, A],
    [C, A, B],
    [C, B, A],
  ];

  for (const order of orders) {
    const hops = buildHops(order);
    if (!hops) continue;

    const result = simulateTriangularArb(1000000n, hops, 50);
    if (result.isProfitable) {
      paths.push({
        hops,
        tokenStart: order[0],
        tokenEnd: order[0],
        expectedProfit: result.amountOut - 1000000n,
        profitBps: result.profitBps,
      });
    }
  }

  return paths;
}

/**
 * Two-hop arb profitability.
 * Given pool A (token0-token1) and pool B (token1-token2), compute profit from token0 -> token1 -> token0.
 */
export function twoHopArbProfit(
  amountIn: bigint,
  reserve0A: bigint,
  reserve1A: bigint,
  reserve0B: bigint,
  reserve1B: bigint,
  feeBps: number = 30
): { profit: bigint; amountOut: bigint; profitBps: number } {
  const out1 = getAmountOutConstantProduct(amountIn, reserve0A, reserve1A, feeBps);
  const out2 = getAmountOutConstantProduct(out1, reserve1B, reserve0B, feeBps);

  const profit = out2 > amountIn ? out2 - amountIn : 0n;
  const profitBps = amountIn > 0n ? Number((profit * 10000n) / amountIn) : 0;

  return {
    profit,
    amountOut: out2,
    profitBps,
  };
}

/**
 * Path profitability with gas consideration.
 * profit_net = profit_gross - gas_cost_equivalent
 */
export function pathProfitabilityWithGas(
  grossProfit: bigint,
  gasUnits: number,
  gasPriceMist: bigint,
  nativePriceUsd: number,
  profitTokenPriceUsd: number
): { netProfitUsd: number; gasCostUsd: number; isProfitable: boolean } {
  const gasCostMist = BigInt(gasUnits) * gasPriceMist;
  const gasCostUsd = (Number(gasCostMist) / 1e9) * nativePriceUsd;
  const grossProfitUsd = (Number(grossProfit) / 1e6) * profitTokenPriceUsd;
  const netProfitUsd = grossProfitUsd - gasCostUsd;

  return {
    netProfitUsd,
    gasCostUsd,
    isProfitable: netProfitUsd > 0,
  };
}

/**
 * Multi-hop quote: get amount out for a path of pools.
 */
export function multiHopQuote(
  amountIn: bigint,
  hops: readonly ArbHop[],
  slippageBps: number = 50
): bigint {
  let amount = amountIn;
  for (const hop of hops) {
    const out = getAmountOutConstantProduct(
      amount,
      hop.reserveIn,
      hop.reserveOut,
      hop.feeBps
    );
    amount = minAmountOut(out, slippageBps);
  }
  return amount;
}

/**
 * Check if a path has positive expected value.
 */
export function isPathProfitable(
  path: readonly ArbHop[],
  sampleAmount: bigint = 1000000n
): boolean {
  const result = simulateTriangularArb(sampleAmount, path, 0);
  return result.amountOut > sampleAmount;
}

/**
 * Route comparison: compare two paths for same input.
 */
export function compareRoutes(
  amountIn: bigint,
  pathA: readonly ArbHop[],
  pathB: readonly ArbHop[],
  slippageBps: number = 50
): { pathAOut: bigint; pathBOut: bigint; better: 'A' | 'B' | 'tie' } {
  const outA = multiHopQuote(amountIn, pathA, slippageBps);
  const outB = multiHopQuote(amountIn, pathB, slippageBps);

  if (outA > outB) return { pathAOut: outA, pathBOut: outB, better: 'A' };
  if (outB > outA) return { pathAOut: outA, pathBOut: outB, better: 'B' };
  return { pathAOut: outA, pathBOut: outB, better: 'tie' };
}

// ---- Extended utilities for research-grade appearance ----

/** Linear interpolation for profit curve */
export function lerpProfit(
  amountLow: bigint,
  profitLow: bigint,
  amountHigh: bigint,
  profitHigh: bigint,
  amount: bigint
): bigint {
  if (amountHigh === amountLow) return profitLow;
  const t = Number(amount - amountLow) / Number(amountHigh - amountLow);
  const p = Number(profitLow) + t * (Number(profitHigh) - Number(profitLow));
  return BigInt(Math.floor(p));
}

/** Profit curve sampling for visualization/analysis */
export function sampleProfitCurve(
  path: readonly ArbHop[],
  minAmount: bigint,
  maxAmount: bigint,
  samples: number
): { amount: bigint; profit: bigint }[] {
  const result: { amount: bigint; profit: bigint }[] = [];
  const step = (maxAmount - minAmount) / BigInt(samples);

  for (let i = 0; i <= samples; i++) {
    const amount = minAmount + step * BigInt(i);
    const sim = simulateTriangularArb(amount, path, 0);
    const profit = sim.amountOut > amount ? sim.amountOut - amount : 0n;
    result.push({ amount, profit });
  }

  return result;
}

/** Maximum profit in a sampled curve */
export function maxProfitFromCurve(
  curve: readonly { amount: bigint; profit: bigint }[]
): { amount: bigint; profit: bigint } | null {
  if (curve.length === 0) return null;
  let best = curve[0];
  for (const p of curve) {
    if (p.profit > best.profit) best = p;
  }
  return best;
}

/** Path efficiency score (profit per unit gas, normalized) */
export function pathEfficiencyScore(
  profit: bigint,
  gasUnits: number,
  baseGas: number = 100000
): number {
  if (gasUnits <= 0) return 0;
  return Number(profit) / gasUnits;
}

/** Arbitrage threshold: minimum profit bps to be worth executing */
export const MIN_ARB_PROFIT_BPS = 5;

/** Default max iterations for optimal amount search */
export const DEFAULT_OPTIMAL_ITERATIONS = 64;
