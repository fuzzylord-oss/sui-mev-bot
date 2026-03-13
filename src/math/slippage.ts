/**
 * Slippage and Fee Mathematics
 *
 * Slippage bounds, fee models (fixed, tiered), price decay curves,
 * MEV-adjusted slippage estimates, and execution guarantees.
 *
 * References:
 * - Uniswap v2/v3 slippage and minAmountOut
 * - Curve fee tiers and dynamic fees
 * - Sandwich protection models
 */

import { Q96, SCALE, getAmountOutConstantProduct } from './amm';

/** Slippage configuration */
export interface SlippageConfig {
  readonly bps: number;
  readonly useTolerance: 'input' | 'output' | 'both';
  readonly decayFactor?: number; // For time-decay of tolerance
}

/** Tiered fee structure */
export interface FeeTier {
  readonly volumeBps: number;
  readonly feeBps: number;
  readonly minVolume: bigint;
}

/** Price decay curve for MEV-adjusted slippage */
export interface PriceDecayCurve {
  readonly initialBps: number;
  readonly halfLifeMs: number;
  readonly floorBps: number;
}

/** Result of slippage calculation */
export interface SlippageResult {
  readonly minAmountOut: bigint;
  readonly maxAmountIn: bigint;
  readonly effectiveSlippageBps: number;
  readonly priceImpactBps: number;
  readonly feeDeductionBps: number;
}

/**
 * Compute minimum amount out for a given slippage tolerance.
 * minOut = amountOut * (10000 - slippageBps) / 10000
 */
export function minAmountOut(
  amountOut: bigint,
  slippageBps: number
): bigint {
  if (slippageBps < 0 || slippageBps > 10000) {
    throw new Error('Slippage must be between 0 and 10000 bps');
  }
  return (amountOut * BigInt(10000 - slippageBps)) / 10000n;
}

/**
 * Compute maximum amount in for a given slippage tolerance.
 * For same output, maxIn increases with slippage.
 */
export function maxAmountIn(
  amountIn: bigint,
  slippageBps: number
): bigint {
  if (slippageBps < 0 || slippageBps > 10000) {
    throw new Error('Slippage must be between 0 and 10000 bps');
  }
  return (amountIn * BigInt(10000 + slippageBps)) / 10000n;
}

/**
 * Slippage bounds for sandwich execution.
 * Accounts for front-run price impact + victim tx + back-run execution.
 */
export function sandwichSlippageBounds(
  victimAmountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  ourAmountIn: bigint,
  feeBps: number,
  safetyBps: number = 50
): { minOut: bigint; effectiveSlippageBps: number } {
  const amountOut = getAmountOutConstantProduct(
    ourAmountIn, reserveIn, reserveOut, feeBps
  );
  // Victim's trade shifts price against us - add extra buffer
  const victimImpact = Number(victimAmountIn) / Number(reserveIn);
  const extraSlippage = Math.min(500, Math.round(victimImpact * 5000));
  const totalSlippage = safetyBps + extraSlippage;
  return {
    minOut: minAmountOut(amountOut, totalSlippage),
    effectiveSlippageBps: totalSlippage,
  };
}

/**
 * Fixed fee model: constant bps on all trades.
 */
export function fixedFeeBps(
  _amount: bigint,
  feeBps: number
): bigint {
  return (_amount * BigInt(feeBps)) / 10000n;
}

/**
 * Tiered fee: fee decreases with volume.
 * volumeBps determines which tier applies.
 */
export function tieredFeeBps(
  amount: bigint,
  tiers: readonly FeeTier[],
  cumulativeVolume: bigint
): number {
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (cumulativeVolume >= tiers[i].minVolume) {
      return tiers[i].feeBps;
    }
  }
  return tiers[0]?.feeBps ?? 30;
}

/**
 * Dynamic fee based on pool imbalance.
 * Higher imbalance -> higher fee (Curve-style).
 */
export function dynamicFeeFromImbalance(
  reserve0: bigint,
  reserve1: bigint,
  baseFeeBps: number = 30,
  maxFeeBps: number = 100
): number {
  if (reserve0 <= 0n || reserve1 <= 0n) return baseFeeBps;
  const ratio = Number(reserve0) / Number(reserve1);
  // Deviation from 1.0
  const deviation = Math.abs(Math.log(ratio));
  const feeBoost = Math.min(maxFeeBps - baseFeeBps, Math.round(deviation * 500));
  return baseFeeBps + feeBoost;
}

/**
 * Price decay: slippage tolerance decays over time.
 * For time-sensitive MEV: wider initial tolerance, decays to floor.
 */
export function slippageWithDecay(
  elapsedMs: number,
  curve: PriceDecayCurve
): number {
  const decay = Math.exp(-0.693 * elapsedMs / curve.halfLifeMs);
  const effective = curve.initialBps * decay + curve.floorBps * (1 - decay);
  return Math.round(Math.max(curve.floorBps, effective));
}

/**
 * MEV-adjusted slippage: account for competitor bots.
 * Assumes N competing searchers, each with same probability.
 */
export function mevAdjustedSlippage(
  baseSlippageBps: number,
  competitorCount: number,
  urgencyFactor: number = 1.0
): number {
  if (competitorCount <= 0) return baseSlippageBps;
  // More competitors -> need to be more aggressive (wider tolerance)
  const multiplier = 1 + Math.log1p(competitorCount) * 0.1 * urgencyFactor;
  return Math.min(1000, Math.round(baseSlippageBps * multiplier));
}

/**
 * Compute full slippage result for a swap.
 */
export function computeSlippageResult(
  amountIn: bigint,
  amountOut: bigint,
  slippageBps: number,
  feeBps: number
): SlippageResult {
  const minOut = minAmountOut(amountOut, slippageBps);
  const maxIn = maxAmountIn(amountIn, slippageBps);
  const feeDeduction = (amountIn * BigInt(feeBps)) / 10000n;
  const effectiveSlippage =
    amountOut > 0n
      ? Number((amountOut - minOut) * SCALE / amountOut) / Number(SCALE) * 10000
      : 0;
  const priceImpactBps = Math.round(
    (1 - Number(minOut) / Number(amountOut)) * 10000
  );
  return {
    minAmountOut: minOut,
    maxAmountIn: maxIn,
    effectiveSlippageBps: Math.round(effectiveSlippage),
    priceImpactBps,
    feeDeductionBps: feeBps,
  };
}

/**
 * Verify execution meets minimum output.
 */
export function meetsMinOut(
  amountOut: bigint,
  minAmountOut: bigint
): boolean {
  return amountOut >= minAmountOut;
}

/**
 * Verify execution within max input.
 */
export function withinMaxIn(
  amountIn: bigint,
  maxAmountIn: bigint
): boolean {
  return amountIn <= maxAmountIn;
}

/**
 * Sqrt-price based slippage (for concentrated liquidity).
 */
export function slippageFromSqrtPrice(
  sqrtPriceBefore: bigint,
  sqrtPriceAfter: bigint
): number {
  if (sqrtPriceBefore <= 0n) return 0;
  const ratio = Number(sqrtPriceAfter) / Number(sqrtPriceBefore);
  return Math.round((1 - ratio) * 10000);
}

/**
 * Deadline-adjusted slippage (broader near expiry).
 */
export function deadlineAdjustedSlippage(
  baseSlippageBps: number,
  deadlineMs: number,
  currentMs: number
): number {
  const remaining = Math.max(0, deadlineMs - currentMs);
  if (remaining <= 0) return 10000; // Max slippage at expiry
  const decay = remaining / 60000; // Normalize to 1 min
  const factor = 1 + (1 - Math.min(1, decay)) * 0.5;
  return Math.min(1000, Math.round(baseSlippageBps * factor));
}

// ---- Extended utilities ----

/** Format slippage as percentage string */
export function formatSlippageBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

/** Parse slippage from user input (e.g. "0.5" -> 50 bps) */
export function parseSlippageBps(input: string): number {
  const pct = parseFloat(input);
  if (isNaN(pct) || pct < 0 || pct > 100) throw new Error('Invalid slippage');
  return Math.round(pct * 100);
}

/** Default slippage config for MEV */
export const DEFAULT_MEV_SLIPPAGE: SlippageConfig = {
  bps: 100,
  useTolerance: 'output',
  decayFactor: 0.99,
};

/** Conservative slippage for large trades */
export const CONSERVATIVE_SLIPPAGE_BPS = 50;

/** Aggressive slippage for time-critical arb */
export const AGGRESSIVE_SLIPPAGE_BPS = 200;

// ---- Extended slippage models ----

/**
 * Geometric mean slippage over multiple hops.
 * sqrt(prod(1 - s_i)) for independent slippage events.
 */
export function geometricSlippageBps(slippageBpsPerHop: number[]): number {
  if (slippageBpsPerHop.length === 0) return 0;
  const factors = slippageBpsPerHop.map((s) => (10000 - s) / 10000);
  const product = factors.reduce((a, b) => a * b, 1);
  return Math.round((1 - product) * 10000);
}

/**
 * Worst-case slippage under adversarial ordering.
 * Assumes MEV extractor can reorder our tx relative to others.
 */
export function adversarialSlippageBps(
  nominalBps: number,
  mempoolDepth: number
): number {
  const depthFactor = 1 + Math.min(mempoolDepth, 10) * 0.05;
  return Math.round(nominalBps * depthFactor);
}

/**
 * Volatility-adjusted slippage.
 * Higher volatility -> wider tolerance needed for same fill probability.
 */
export function volatilityAdjustedSlippage(
  baseBps: number,
  volatilityBps: number
): number {
  return Math.round(baseBps + volatilityBps * 0.5);
}

/** Fee impact on effective slippage: effective = raw + fee_bps */
export function effectiveSlippageWithFee(
  rawSlippageBps: number,
  feeBps: number
): number {
  return rawSlippageBps + feeBps;
}

/** Confidence interval for slippage (95% within bounds) */
export function slippageConfidenceInterval(
  meanBps: number,
  stdDevBps: number
): { lower: number; upper: number } {
  const margin = 1.96 * stdDevBps;
  return {
    lower: Math.max(0, Math.round(meanBps - margin)),
    upper: Math.min(10000, Math.round(meanBps + margin)),
  };
}

/** Quadratic slippage model: s = a * size^2 + b * size + c */
export function quadraticSlippageModel(
  tradeSizeRatio: number,
  coeffs: { a: number; b: number; c: number }
): number {
  const { a, b, c } = coeffs;
  return Math.min(10000, Math.round(a * tradeSizeRatio ** 2 + b * tradeSizeRatio + c));
}

/** Linear interpolation of slippage between two known points */
export function interpolateSlippage(
  size1: bigint,
  slip1: number,
  size2: bigint,
  slip2: number,
  sizeQuery: bigint
): number {
  if (size1 === size2) return slip1;
  const t = Number(sizeQuery - size1) / Number(size2 - size1);
  return slip1 + t * (slip2 - slip1);
}

/** Kinked slippage: flat until threshold, then linear */
export function kinkedSlippage(
  tradeSize: bigint,
  liquidity: bigint,
  flatBps: number,
  slopePerPercent: number
): number {
  const ratio = Number(tradeSize) / Number(liquidity);
  if (ratio <= 0.01) return flatBps;
  return flatBps + (ratio - 0.01) * 100 * slopePerPercent;
}

/** Pool-specific slippage cap (some pools have max slippage) */
export function capSlippageToPoolMax(
  computedBps: number,
  poolMaxBps: number
): number {
  return Math.min(computedBps, poolMaxBps);
}

/** Time-weighted average slippage over a window */
export function twapSlippage(
  samples: Array<{ slippageBps: number; weight: number }>
): number {
  const totalWeight = samples.reduce((s, x) => s + x.weight, 0);
  if (totalWeight <= 0) return 0;
  const weighted = samples.reduce((s, x) => s + x.slippageBps * x.weight, 0);
  return weighted / totalWeight;
}
