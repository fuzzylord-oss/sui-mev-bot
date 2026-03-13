/**
 * Concentrated Liquidity Mathematics
 *
 * Uniswap v3 style: tick ranges, liquidity concentration, position math,
 * sqrt-price calculations, and virtual reserve derivation.
 *
 * Key formulas:
 * - L = sqrt(x * y) for constant product in range
 * - sqrt(P) = 1.0001^(tick/2) * 2^96
 * - x = L * (1/sqrt(P) - 1/sqrt(Pb)), y = L * (sqrt(P) - sqrt(Pa))
 */

import { Q96, Q128, bigIntSqrt } from './amm';

/** Tick range [tickLower, tickUpper] */
export interface TickRange {
  readonly tickLower: number;
  readonly tickUpper: number;
}

/** Liquidity position in concentrated pool */
export interface LiquidityPosition {
  readonly liquidity: bigint;
  readonly tickLower: number;
  readonly tickUpper: number;
  readonly sqrtPriceCurrent: bigint;
}

/** Amounts of token0 and token1 in a position */
export interface PositionAmounts {
  readonly amount0: bigint;
  readonly amount1: bigint;
}

/** Q64.96 fixed-point sqrt price */
export type SqrtPriceX96 = bigint;

/** Minimum tick in Uniswap v3 (from -887272) */
export const MIN_TICK = -887272;

/** Maximum tick in Uniswap v3 (to 887272) */
export const MAX_TICK = 887272;

/** Price step per tick: 1.0001 */
export const PRICE_STEP = 1.0001;

/**
 * Compute sqrt(1.0001^tick) * 2^96.
 * sqrt(P) = 1.0001^(tick/2)
 */
export function sqrtPriceX96FromTick(tick: number): SqrtPriceX96 {
  const exp = Math.pow(PRICE_STEP, tick / 2);
  return BigInt(Math.floor(exp * Number(Q96)));
}

/**
 * Compute tick from sqrt price (Q64.96).
 * tick = 2 * log(sqrtPrice / 2^96) / log(1.0001)
 */
export function tickFromSqrtPriceX96(sqrtPriceX96: SqrtPriceX96): number {
  const price = Number(sqrtPriceX96) / Number(Q96);
  return Math.floor(2 * Math.log(price) / Math.log(PRICE_STEP));
}

/**
 * Get sqrt price at tick boundary.
 */
export function sqrtPriceAtTick(tick: number): bigint {
  return sqrtPriceX96FromTick(tick);
}

/**
 * Compute amount0 (token0) needed for liquidity L in range [tickLower, tickUpper].
 * amount0 = L * (1/sqrt(P_current) - 1/sqrt(P_upper))
 */
export function getAmount0ForLiquidity(
  sqrtPriceCurrent: SqrtPriceX96,
  sqrtPriceLower: SqrtPriceX96,
  sqrtPriceUpper: SqrtPriceX96,
  liquidity: bigint
): bigint {
  if (sqrtPriceCurrent <= sqrtPriceLower) {
    return liquidity * (Q96 * Q96 / sqrtPriceLower - Q96 * Q96 / sqrtPriceUpper) / Q96;
  }
  if (sqrtPriceCurrent >= sqrtPriceUpper) {
    return 0n;
  }
  return liquidity * (Q96 * Q96 / sqrtPriceCurrent - Q96 * Q96 / sqrtPriceUpper) / Q96;
}

/**
 * Compute amount1 (token1) needed for liquidity L in range [tickLower, tickUpper].
 * amount1 = L * (sqrt(P_current) - sqrt(P_lower))
 */
export function getAmount1ForLiquidity(
  sqrtPriceCurrent: SqrtPriceX96,
  sqrtPriceLower: SqrtPriceX96,
  sqrtPriceUpper: SqrtPriceX96,
  liquidity: bigint
): bigint {
  if (sqrtPriceCurrent <= sqrtPriceLower) {
    return 0n;
  }
  if (sqrtPriceCurrent >= sqrtPriceUpper) {
    return liquidity * (sqrtPriceUpper - sqrtPriceLower) / Q96;
  }
  return liquidity * (sqrtPriceCurrent - sqrtPriceLower) / Q96;
}

/**
 * Compute liquidity L from amounts and price range.
 * For a position with token0 and token1, L = min(L0, L1) where:
 * L0 = amount0 * sqrt(Pa) * sqrt(Pb) / (sqrt(Pb) - sqrt(Pa))
 * L1 = amount1 / (sqrt(P) - sqrt(Pa))
 */
export function getLiquidityFromAmounts(
  sqrtPriceCurrent: SqrtPriceX96,
  sqrtPriceLower: SqrtPriceX96,
  sqrtPriceUpper: SqrtPriceX96,
  amount0: bigint,
  amount1: bigint
): bigint {
  if (sqrtPriceCurrent <= sqrtPriceLower) {
    const liquidity0 = amount0 * sqrtPriceLower * sqrtPriceUpper / (sqrtPriceUpper - sqrtPriceLower) * Q96 / (Q96 * Q96);
    return liquidity0;
  }
  if (sqrtPriceCurrent >= sqrtPriceUpper) {
    const liquidity1 = amount1 * Q96 / (sqrtPriceUpper - sqrtPriceLower);
    return liquidity1;
  }

  const liquidity0 = amount0 * sqrtPriceCurrent * sqrtPriceUpper / (sqrtPriceUpper - sqrtPriceCurrent) * Q96 / (Q96 * Q96);
  const liquidity1 = amount1 * Q96 / (sqrtPriceCurrent - sqrtPriceLower);
  return liquidity0 < liquidity1 ? liquidity0 : liquidity1;
}

/**
 * Compute liquidity from sqrt price and reserves (simplified for in-range).
 * L = sqrt(x * y) when price is in range
 */
export function liquidityFromReservesInRange(
  reserve0: bigint,
  reserve1: bigint,
  sqrtPrice: SqrtPriceX96
): bigint {
  const term0 = reserve0 * sqrtPrice;
  const term1 = reserve1 * Q96 * Q96 / sqrtPrice;
  return bigIntSqrt(term0 + term1);
}

/**
 * Compute swap output for a single tick crossing.
 * When crossing a tick, liquidity changes; this computes output for one tick.
 */
export function computeSwapStep(
  liquidity: bigint,
  sqrtPriceCurrent: SqrtPriceX96,
  sqrtPriceTarget: SqrtPriceX96,
  amountRemaining: bigint,
  feeBps: number
): {
  sqrtPriceNext: SqrtPriceX96;
  amountIn: bigint;
  amountOut: bigint;
  feeAmount: bigint;
} {
  const amountInWithFee = (amountRemaining * BigInt(10000 - feeBps)) / 10000n;

  const sqrtPriceNext = computeNextSqrtPrice(sqrtPriceCurrent, liquidity, amountInWithFee, true);
  const amountIn = computeInputAmount(sqrtPriceCurrent, sqrtPriceNext, liquidity);
  const amountOut = computeOutputAmount(sqrtPriceCurrent, sqrtPriceNext, liquidity);
  const feeAmount = amountRemaining - amountInWithFee;

  return {
    sqrtPriceNext,
    amountIn,
    amountOut,
    feeAmount,
  };
}

function computeNextSqrtPrice(
  sqrtPrice: SqrtPriceX96,
  liquidity: bigint,
  amount: bigint,
  zeroForOne: boolean
): SqrtPriceX96 {
  if (liquidity === 0n) return sqrtPrice;

  if (zeroForOne) {
    const numerator = liquidity * Q96;
    const denominator = liquidity * Q96 / sqrtPrice + amount;
    return numerator / denominator;
  } else {
    return sqrtPrice + (amount * Q96) / liquidity;
  }
}

function computeInputAmount(
  sqrtPriceFrom: SqrtPriceX96,
  sqrtPriceTo: SqrtPriceX96,
  liquidity: bigint
): bigint {
  const diff = sqrtPriceFrom > sqrtPriceTo ? sqrtPriceFrom - sqrtPriceTo : sqrtPriceTo - sqrtPriceFrom;
  return (liquidity * diff) / (Q96 * Q96) * sqrtPriceFrom * sqrtPriceTo / (sqrtPriceFrom * sqrtPriceTo);
}

function computeOutputAmount(
  sqrtPriceFrom: SqrtPriceX96,
  sqrtPriceTo: SqrtPriceX96,
  liquidity: bigint
): bigint {
  const diff = sqrtPriceFrom > sqrtPriceTo ? sqrtPriceFrom - sqrtPriceTo : sqrtPriceTo - sqrtPriceFrom;
  return (liquidity * diff) / Q96;
}

/**
 * Virtual reserves for concentrated liquidity in current range.
 * Equivalent to x = L/sqrt(P), y = L*sqrt(P) for in-range.
 */
export function virtualReserves(
  liquidity: bigint,
  sqrtPrice: SqrtPriceX96
): { virtualX: bigint; virtualY: bigint } {
  const virtualX = (liquidity * Q96) / sqrtPrice;
  const virtualY = (liquidity * sqrtPrice) / Q96;
  return { virtualX, virtualY };
}

/**
 * Price impact for concentrated liquidity swap.
 * Smaller impact than constant product for same liquidity when in range.
 */
export function concentratedPriceImpact(
  amountIn: bigint,
  liquidity: bigint,
  sqrtPrice: SqrtPriceX96,
  zeroForOne: boolean
): number {
  const { virtualX, virtualY } = virtualReserves(liquidity, sqrtPrice);
  const reserveIn = zeroForOne ? virtualX : virtualY;
  const reserveOut = zeroForOne ? virtualY : virtualX;

  if (reserveIn <= 0n) return 10000;
  const ratio = Number(amountIn) / Number(reserveIn);
  return Math.min(10000, Math.round(ratio * 3000));
}

/**
 * Fee growth per liquidity unit (Uniswap v3 accumulator).
 * Simplified: feeGrowth = feeAmount * 2^128 / L
 */
export function feeGrowthInside(
  feeGrowthGlobal0: bigint,
  feeGrowthGlobal1: bigint,
  tickLower: number,
  tickUpper: number,
  tickCurrent: number
): { feeGrowth0: bigint; feeGrowth1: bigint } {
  if (tickCurrent < tickLower) {
    return { feeGrowth0: 0n, feeGrowth1: 0n };
  }
  if (tickCurrent > tickUpper) {
    return { feeGrowth0: feeGrowthGlobal0, feeGrowth1: feeGrowthGlobal1 };
  }
  return { feeGrowth0: feeGrowthGlobal0 / 2n, feeGrowth1: feeGrowthGlobal1 / 2n };
}

/**
 * Position value in terms of token amounts.
 */
export function getPositionAmounts(
  liquidity: bigint,
  sqrtPriceCurrent: SqrtPriceX96,
  tickLower: number,
  tickUpper: number
): PositionAmounts {
  const sqrtLower = sqrtPriceX96FromTick(tickLower);
  const sqrtUpper = sqrtPriceX96FromTick(tickUpper);

  const amount0 = getAmount0ForLiquidity(sqrtPriceCurrent, sqrtLower, sqrtUpper, liquidity);
  const amount1 = getAmount1ForLiquidity(sqrtPriceCurrent, sqrtLower, sqrtUpper, liquidity);

  return { amount0, amount1 };
}

/**
 * Tick spacing for common fee tiers.
 * 1 = 0.01%, 10 = 0.05%, 60 = 0.3%, 200 = 1%
 */
export const TICK_SPACING: Record<number, number> = {
  100: 1,
  500: 10,
  3000: 60,
  10000: 200,
};

/**
 * Nearest valid tick for fee tier.
 */
export function nearestValidTick(tick: number, feeBps: number): number {
  const spacing = TICK_SPACING[feeBps] ?? 60;
  return Math.floor(tick / spacing) * spacing;
}

/**
 * Initialize a concentrated liquidity pool state.
 */
export interface ClPoolState {
  readonly liquidity: bigint;
  readonly sqrtPriceCurrent: SqrtPriceX96;
  readonly tickCurrent: number;
  readonly feeBps: number;
  readonly tickSpacing: number;
}

/**
 * Simulate swap through concentrated liquidity (simplified single-tick).
 */
export function swapClPool(
  pool: ClPoolState,
  amountIn: bigint,
  zeroForOne: boolean
): { amountOut: bigint; newSqrtPrice: SqrtPriceX96 } {
  const { sqrtPriceNext, amountOut } = computeSwapStep(
    pool.liquidity,
    pool.sqrtPriceCurrent,
    zeroForOne ? sqrtPriceX96FromTick(MIN_TICK) : sqrtPriceX96FromTick(MAX_TICK),
    amountIn,
    pool.feeBps
  );
  return { amountOut, newSqrtPrice: sqrtPriceNext };
}

// ---- Extended utilities ----

/** Encode tick as bytes for storage */
export function encodeTick(tick: number): Uint8Array {
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setInt32(0, tick, true);
  return new Uint8Array(buf);
}

/** Decode tick from bytes */
export function decodeTick(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer);
  return view.getInt32(0, true);
}

/** Liquidity density (L per unit of price range) */
export function liquidityDensity(
  liquidity: bigint,
  tickLower: number,
  tickUpper: number
): number {
  const range = tickUpper - tickLower;
  if (range <= 0) return 0;
  return Number(liquidity) / range;
}
