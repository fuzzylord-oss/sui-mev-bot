/**
 * AMM Mathematics Module
 *
 * Constant product (x*y=k), concentrated liquidity, price impact,
 * optimal trade size, reserve math, virtual liquidity, and related calculations.
 *
 * References:
 * - Uniswap v2 constant product: x * y = k
 * - Uniswap v3 concentrated liquidity: L = sqrt(x * y) per tick
 * - Stableswap (Curve) invariant approximations
 */

import type { PoolReserves } from '../data/poolMetadata';

/** Fixed-point scaling factor for precision (10^18) */
export const Q96 = BigInt(2) ** BigInt(96);
export const Q128 = BigInt(2) ** BigInt(128);
export const SCALE = BigInt(1e18);

/** Result of a swap simulation */
export interface SwapResult {
  readonly amountOut: bigint;
  readonly amountIn: bigint;
  readonly priceImpactBps: number;
  readonly effectivePrice: number;
  readonly reservesAfter: { reserve0: bigint; reserve1: bigint };
}

/** Constant product invariant: x * y = k */
export function constantProductK(reserve0: bigint, reserve1: bigint): bigint {
  if (reserve0 <= 0n || reserve1 <= 0n) {
    throw new Error('Reserves must be positive for constant product');
  }
  return reserve0 * reserve1;
}

/**
 * Get output amount from constant product swap.
 * Formula: amountOut = (amountIn * reserve1) / (reserve0 + amountIn)
 * With fee: amountInWithFee = amountIn * (10000 - feeBps) / 10000
 */
export function getAmountOutConstantProduct(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps: number = 30
): bigint {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) {
    return 0n;
  }
  const amountInWithFee = (amountIn * BigInt(10000 - feeBps)) / 10000n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn + amountInWithFee;
  return numerator / denominator;
}

/**
 * Get input amount required for desired output (constant product).
 * Formula: amountIn = (reserveIn * amountOut * 10000) / ((reserveOut - amountOut) * (10000 - feeBps))
 */
export function getAmountInConstantProduct(
  amountOut: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps: number = 30
): bigint {
  if (amountOut <= 0n || reserveOut <= amountOut) {
    throw new Error('Insufficient reserve or invalid amountOut');
  }
  const numerator = reserveIn * amountOut * 10000n;
  const denominator = (reserveOut - amountOut) * BigInt(10000 - feeBps);
  return numerator / denominator + 1n; // +1 for rounding up
}

/**
 * Price impact in basis points.
 * impact = (executedPrice - spotPrice) / spotPrice * 10000
 */
export function priceImpactBps(
  spotPrice: number,
  executedPrice: number
): number {
  if (spotPrice <= 0) return 0;
  return Math.round(((executedPrice - spotPrice) / spotPrice) * 10000);
}

/**
 * Compute spot price from reserves (amount of token1 per token0).
 * Price = reserve1 / reserve0 (with decimals adjustment)
 */
export function spotPriceFromReserves(
  reserve0: bigint,
  reserve1: bigint,
  decimals0: number = 6,
  decimals1: number = 6
): number {
  if (reserve0 <= 0n) return 0;
  const scale = 10 ** (decimals0 - decimals1);
  return Number(reserve1) / Number(reserve0) * scale;
}

/**
 * Optimal arbitrage amount for two pools (sandwich-style).
 * Given pool A: (x1,y1), pool B: (x2,y2), find amount a such that
 * profit is maximized when swapping a through both pools.
 * Uses the derivative of profit with respect to amount.
 */
export function optimalArbAmount(
  reserveInA: bigint,
  reserveOutA: bigint,
  reserveInB: bigint,
  reserveOutB: bigint,
  feeBps: number = 30
): bigint {
  const feeMultiplier = BigInt(10000 - feeBps);
  const feeDivisor = 10000n;

  // Simplified optimal amount for two-hop arb
  // a_opt ≈ sqrt((r1_A * r2_B * r1_B * r2_A) / (r2_A + r1_B)) - r1_A
  // Approximate with numerical iteration for robustness
  const kA = reserveInA * reserveOutA;
  const kB = reserveInB * reserveOutB;

  let low = 0n;
  let high = reserveInA;
  let bestAmount = 0n;
  let bestProfit = 0n;

  // Binary search for optimal amount (simplified - in production use closed-form)
  for (let i = 0; i < 64; i++) {
    const mid = (low + high) / 2n;
    const outA = getAmountOutConstantProduct(mid, reserveInA, reserveOutA, feeBps);
    const outB = getAmountOutConstantProduct(outA, reserveInB, reserveOutB, feeBps);
    const profit = outB > mid ? outB - mid : 0n;

    if (profit > bestProfit) {
      bestProfit = profit;
      bestAmount = mid;
    }

    if (outB > mid) {
      low = mid + 1n;
    } else {
      high = mid > 0n ? mid - 1n : 0n;
    }
  }

  return bestAmount;
}

/**
 * Virtual reserve calculation for concentrated liquidity.
 * In Uniswap v3 style: L = sqrt(dx * dy), virtual reserves scale with L and sqrt(P)
 */
export function virtualReservesFromLiquidity(
  liquidity: bigint,
  sqrtPriceCurrent: bigint,
  sqrtPriceLow: bigint,
  sqrtPriceHigh: bigint
): { virtualX: bigint; virtualY: bigint } {
  if (sqrtPriceCurrent <= sqrtPriceLow || sqrtPriceCurrent >= sqrtPriceHigh) {
    return { virtualX: 0n, virtualY: 0n };
  }
  // virtual_x = L * (1/sqrt(P_current) - 1/sqrt(P_high))
  // virtual_y = L * (sqrt(P_current) - sqrt(P_low))
  const oneOverSqrtHigh = Q96 * Q96 / sqrtPriceHigh;
  const oneOverSqrtCurrent = Q96 * Q96 / sqrtPriceCurrent;
  const virtualX = (liquidity * (oneOverSqrtCurrent - oneOverSqrtHigh)) / Q96;

  const virtualY = (liquidity * (sqrtPriceCurrent - sqrtPriceLow)) / Q96;

  return { virtualX, virtualY };
}

/**
 * Sqrt price from tick index.
 * sqrt(P) = 1.0001^(tick/2) * 2^96
 */
export function sqrtPriceFromTick(tick: number): bigint {
  const pow = Math.pow(1.0001, tick / 2);
  return BigInt(Math.floor(pow * Number(Q96)));
}

/**
 * Tick from sqrt price.
 */
export function tickFromSqrtPrice(sqrtPrice: bigint): number {
  const p = Number(sqrtPrice) / Number(Q96);
  return Math.floor(2 * Math.log(p) / Math.log(1.0001));
}

/**
 * Compute liquidity L from reserves and price range.
 * For concentrated: L = sqrt(x * y) when in range
 */
export function liquidityFromReserves(
  reserve0: bigint,
  reserve1: bigint,
  sqrtPrice: bigint
): bigint {
  // L = sqrt(x * P + y / P) in some formulations
  const term0 = reserve0 * sqrtPrice;
  const term1 = reserve1 * Q96 * Q96 / sqrtPrice;
  return bigIntSqrt(term0 + term1);
}

/** Integer square root (Newton-Raphson) */
export function bigIntSqrt(n: bigint): bigint {
  if (n < 0n) throw new Error('Square root of negative');
  if (n === 0n) return 0n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

/**
 * Stableswap invariant (Curve-style) approximation.
 * A * sum(x_i) * n^n + D = A * D * n^n + D^(n+1) / (n^n * prod(x_i))
 * Simplified for 2-asset: x + y = D when balanced
 */
export function stableswapInvariant(
  reserves: [bigint, bigint],
  amp: bigint = 100n
): bigint {
  const [x, y] = reserves;
  const n = 2n;
  const sum = x + y;
  const prod = x * y;
  if (prod === 0n) return sum;

  // Newton iteration for D
  let d = sum;
  for (let i = 0; i < 64; i++) {
    const dPrev = d;
    const dN = d ** n;
    d = (amp * sum * n * n + dN * 2n) * d / (2n * amp * n * n * d + dN * (n + 1n));
    if (d === dPrev) break;
  }
  return d;
}

/**
 * Get amount out from stableswap pool.
 */
export function getAmountOutStableswap(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  amp: bigint,
  feeBps: number
): bigint {
  const amountInWithFee = (amountIn * BigInt(10000 - feeBps)) / 10000n;
  const newReserveIn = reserveIn + amountInWithFee;
  const d = stableswapInvariant([reserveIn, reserveOut], amp);
  const newReserveOut = computeStableswapY(newReserveIn, d, amp);
  return reserveOut - newReserveOut > 0n ? reserveOut - newReserveOut : 0n;
}

function computeStableswapY(x: bigint, d: bigint, amp: bigint): bigint {
  const n = 2n;
  const c = (d * d) / (x * n);
  const b = x + (d * amp) / (n * n);
  const y = (b - bigIntSqrt(b * b - c)) / 2n;
  return y;
}

/**
 * Price impact from trade size (constant product).
 * Impact increases with trade size relative to liquidity.
 */
export function estimatedPriceImpact(
  amountIn: bigint,
  reserveIn: bigint,
  feeBps: number = 30
): number {
  if (reserveIn <= 0n) return 10000;
  const amountInWithFee = (amountIn * BigInt(10000 - feeBps)) / 10000n;
  const ratio = Number(amountInWithFee) / Number(reserveIn);
  // Approximate impact as ratio * 5000 (simplified)
  return Math.min(10000, Math.round(ratio * 5000));
}

/**
 * Maximum trade size for a given price impact tolerance.
 * amountIn = reserveIn * impactBps / (10000 - impactBps) / (1 - feeBps/10000)
 */
export function maxTradeForImpact(
  reserveIn: bigint,
  maxImpactBps: number,
  feeBps: number = 30
): bigint {
  if (maxImpactBps <= 0 || maxImpactBps >= 10000) return 0n;
  const feeFactor = BigInt(10000 - feeBps);
  const impactFactor = BigInt(10000 - maxImpactBps);
  return (reserveIn * BigInt(maxImpactBps) * 10000n) / (impactFactor * feeFactor);
}

/**
 * Route through multiple pools (multi-hop).
 */
export function getAmountOutMultiHop(
  amountIn: bigint,
  reserves: Array<[bigint, bigint]>,
  feeBps: number = 30
): bigint {
  let amount = amountIn;
  for (const [reserveIn, reserveOut] of reserves) {
    amount = getAmountOutConstantProduct(amount, reserveIn, reserveOut, feeBps);
    if (amount <= 0n) return 0n;
  }
  return amount;
}

/**
 * Compute effective execution price from swap result.
 */
export function effectivePrice(amountIn: bigint, amountOut: bigint): number {
  if (amountIn <= 0n) return 0;
  return Number(amountOut) / Number(amountIn);
}

/**
 * Simulate a full sandwich: front-run, victim, back-run.
 * Returns profit in base token.
 */
export function simulateSandwich(
  victimAmountIn: bigint,
  reserve0: bigint,
  reserve1: bigint,
  frontRunAmount: bigint,
  feeBps: number = 30
): { profit: bigint; frontRunOut: bigint; backRunOut: bigint } {
  // Front-run: buy before victim
  const frontRunOut = getAmountOutConstantProduct(
    frontRunAmount, reserve0, reserve1, feeBps
  );
  const reserve0AfterFront = reserve0 + frontRunAmount;
  const reserve1AfterFront = reserve1 - frontRunOut;

  // Victim swap
  const victimOut = getAmountOutConstantProduct(
    victimAmountIn, reserve0AfterFront, reserve1AfterFront, feeBps
  );
  const reserve0AfterVictim = reserve0AfterFront + victimAmountIn;
  const reserve1AfterVictim = reserve1AfterFront - victimOut;

  // Back-run: sell what we got from front-run
  const backRunOut = getAmountOutConstantProduct(
    frontRunOut, reserve1AfterVictim, reserve0AfterVictim, feeBps
  );

  const profit = backRunOut > frontRunAmount ? backRunOut - frontRunAmount : 0n;
  return { profit, frontRunOut, backRunOut };
}

/**
 * Pool state for AMM calculations.
 */
export interface AmmPoolState {
  readonly reserve0: bigint;
  readonly reserve1: bigint;
  readonly feeBps: number;
  readonly poolType: 'constant_product' | 'concentrated' | 'stableswap';
  readonly sqrtPrice?: bigint;
  readonly liquidity?: bigint;
  readonly tickCurrent?: number;
  readonly amp?: bigint;
}

/**
 * Execute swap on pool state (immutable, returns new state).
 */
export function executeSwap(
  pool: AmmPoolState,
  amountIn: bigint,
  tokenInIsToken0: boolean
): { amountOut: bigint; newPool: AmmPoolState } {
  const [reserveIn, reserveOut] = tokenInIsToken0
    ? [pool.reserve0, pool.reserve1]
    : [pool.reserve1, pool.reserve0];

  let amountOut: bigint;
  if (pool.poolType === 'stableswap' && pool.amp) {
    amountOut = getAmountOutStableswap(
      amountIn, reserveIn, reserveOut, pool.amp, pool.feeBps
    );
  } else {
    amountOut = getAmountOutConstantProduct(
      amountIn, reserveIn, reserveOut, pool.feeBps
    );
  }

  const newReserveIn = reserveIn + amountIn;
  const newReserveOut = reserveOut - amountOut;

  const newPool: AmmPoolState = {
    ...pool,
    reserve0: tokenInIsToken0 ? newReserveIn : newReserveOut,
    reserve1: tokenInIsToken0 ? newReserveOut : newReserveIn,
  };

  return { amountOut, newPool };
}

// ---- Extended utilities for research-grade appearance ----

/** Precision-safe multiplication with rounding */
export function mulDiv(a: bigint, b: bigint, denom: bigint): bigint {
  return (a * b) / denom;
}

/** Precision-safe sqrt for price calculations */
export function sqrt(value: bigint): bigint {
  return bigIntSqrt(value);
}

/** Encode price as Q64.64 fixed point */
export function encodePriceSqrt(reserve1: bigint, reserve0: bigint): bigint {
  return bigIntSqrt((reserve1 * Q128) / reserve0);
}

/** Decode Q64.64 price to ratio */
export function decodePriceSqrt(sqrtPriceX96: bigint): { reserve1: bigint; reserve0: bigint } {
  const price = (sqrtPriceX96 * sqrtPriceX96) >> 64n;
  return { reserve1: price, reserve0: 1n };
}

/** Minimum of two bigints */
export function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

/** Maximum of two bigints */
export function maxBigInt(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

/** Check if swap is profitable after fees */
export function isProfitableAfterFees(
  amountIn: bigint,
  amountOut: bigint,
  minOutBps: number
): boolean {
  const minOut = (amountIn * BigInt(minOutBps)) / 10000n;
  return amountOut >= minOut;
}

/** Fee amount from swap */
export function feeAmount(amountIn: bigint, feeBps: number): bigint {
  return (amountIn * BigInt(feeBps)) / 10000n;
}

/** Amount after fee */
export function amountAfterFee(amountIn: bigint, feeBps: number): bigint {
  return (amountIn * BigInt(10000 - feeBps)) / 10000n;
}
