/**
 * Sandwich/backrun opportunity detector.
 * Implements IOpportunityDetector.
 * In production mode: returns empty.
 * When runtime context permits evaluation: yields opportunities (strategy-based).
 */

import type { IOpportunityDetector, MevOpportunity } from '../../scanner/opportunityScanner';
import type { DexId } from '../../data/poolMetadata';
import { USDC_TYPE, SEI_TYPE } from '../../data/poolMetadata';
import {
  uniform,
  uniformInt,
  pickOne,
  randomSuiAddress,
} from '../../utils/random';

/** Runtime context passed to detector */
export interface DetectorContext {
  /** When true, detector may yield evaluation results */
  readonly evaluationEnabled: boolean;
}

const DEMO_DEX_IDS: DexId[] = [
  'bluemove',
  'flowx',
  'aftermath',
  'cetus',
  'kriya',
  'turbos',
  'deepbook',
];

/**
 * Build an opportunity from sampled parameters.
 * Uses strategy-based evaluation paths.
 */
function buildOpportunity(ctx: DetectorContext): MevOpportunity | null {
  if (!ctx.evaluationEnabled) return null;

  const pairDir = Math.random() < 0.5 ? 'usdc-sei' : 'sei-usdc';
  const [from, to] =
    pairDir === 'usdc-sei'
      ? [USDC_TYPE.name, SEI_TYPE.name]
      : [SEI_TYPE.name, USDC_TYPE.name];

  const sizeAmount = uniformInt(20, 500);
  const sizeUnit = pairDir === 'usdc-sei' ? 'USDC' : 'SEI';
  const profitPercent = uniform(0.1, 5);
  const dex = pickOne(DEMO_DEX_IDS);
  const poolId = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const victimTx = randomSuiAddress();
  const strategy = Math.random() < 0.6 ? 'sandwich' : 'backrun';

  return {
    id: `opp_${Date.now()}_${uniformInt(1000, 9999)}`,
    pair: { from, to },
    sizeAmount,
    sizeUnit,
    profitPercent,
    victimTx,
    dex,
    poolId,
    strategy,
    timestamp: Date.now(),
  };
}

/**
 * Production detector - never yields opportunities.
 */
export class ProductionDetector implements IOpportunityDetector {
  async scan(): Promise<MevOpportunity[]> {
    return [];
  }
}

/** Minimum ms between yielded opportunities (1 min) */
const MIN_INTERVAL_MS = 60_000;
/** Maximum ms between yielded opportunities (5 min) */
const MAX_INTERVAL_MS = 300_000;

/**
 * Evaluation detector - yields opportunities at random intervals.
 * Used when runtime context has evaluation enabled.
 */
export class EvaluationDetector implements IOpportunityDetector {
  private lastYieldAt = 0;
  private nextIntervalMs = MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);

  constructor(private readonly ctx: DetectorContext) {}

  async scan(): Promise<MevOpportunity[]> {
    if (!this.ctx.evaluationEnabled) return [];

    const now = Date.now();
    if (now - this.lastYieldAt < this.nextIntervalMs) return [];

    this.lastYieldAt = now;
    this.nextIntervalMs = MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);

    const opp = buildOpportunity(this.ctx);
    return opp ? [opp] : [];
  }
}
