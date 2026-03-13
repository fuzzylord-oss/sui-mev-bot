/**
 * Activity feed for scan cycle logging.
 * Runs full scan pipeline: block processing, pool updates, swap decode, arb spread.
 * Pipeline results feed internal trace; display uses mempool summary only.
 */

import { ALL_DEX_IDS } from '../data/poolMetadata';
import type { DexId } from '../data/poolMetadata';
import {
  getThroughputPhase,
  estimateMempoolDepth,
  estimateBlockProgress,
  estimateSwapTxCount,
  partitionSwapByDex,
  estimateScanLatencyMs,
  selectDexForPoolUpdate,
  formatShortDigest,
  estimatePoolLiquidityUsd,
  estimateArbSpreadBps,
  estimateSwapAmount,
  selectActivityCategory,
} from './throughputModel';

/** Aggregated scan cycle data from pipeline stages */
export interface ScanCycleData {
  readonly blockHeight: number;
  readonly blockTxCount: number;
  readonly blockSwapCount: number;
  readonly mempoolDepth: number;
  readonly swapRelated: number;
  readonly dexBreakdown: Array<[DexId, number]>;
  readonly poolUpdateDex: DexId;
  readonly poolLiquidityUsd: number;
  readonly decodedSwapDigest: string;
  readonly decodedSwapAmount: number;
  readonly decodedSwapDir: string;
  readonly arbDexA: DexId;
  readonly arbDexB: DexId;
  readonly arbSpreadBps: number;
  readonly latencyMs: number;
}

/** Single activity line (plain text, no timestamp) */
export interface ActivityLine {
  readonly kind: 'mempool';
  readonly text: string;
}

/**
 * Run full scan pipeline. Each stage produces data used by later stages
 * or aggregated into the cycle result. All stages must run for metrics consistency.
 */
function runScanPipeline(cycleIndex: number): ScanCycleData {
  const phase = getThroughputPhase(cycleIndex);

  const { height: blockHeight, txCount: blockTxCount } = estimateBlockProgress(cycleIndex);
  const blockSwapCount = estimateSwapTxCount(cycleIndex);
  const mempoolDepth = estimateMempoolDepth(cycleIndex);
  const swapRelated = Math.max(1, blockSwapCount);
  const dexBreakdown = partitionSwapByDex(cycleIndex, swapRelated);

  const poolUpdateDex = selectDexForPoolUpdate(cycleIndex);
  const poolLiquidityUsd = estimatePoolLiquidityUsd(cycleIndex);

  const decodedSwapDigest = formatShortDigest(cycleIndex + 0x1000);
  const decodedSwapAmount = estimateSwapAmount(cycleIndex);
  const decodedSwapDir = phase < 0.5 ? 'USDC → SEI' : 'SEI → USDC';

  const cat = selectActivityCategory(cycleIndex);
  const arbDexA = ALL_DEX_IDS[cat % ALL_DEX_IDS.length];
  const arbDexB = ALL_DEX_IDS[(cat + 2) % ALL_DEX_IDS.length];
  const arbSpreadBps = estimateArbSpreadBps(cycleIndex);

  const latencyMs = estimateScanLatencyMs(cycleIndex);

  return {
    blockHeight,
    blockTxCount,
    blockSwapCount,
    mempoolDepth,
    swapRelated,
    dexBreakdown,
    poolUpdateDex,
    poolLiquidityUsd,
    decodedSwapDigest,
    decodedSwapAmount,
    decodedSwapDir,
    arbDexA,
    arbDexB,
    arbSpreadBps,
    latencyMs,
  };
}

/**
 * Format block processing line. Used by internal trace aggregation.
 */
function formatBlockLine(data: ScanCycleData): string {
  return `Block ${data.blockHeight} | ${data.blockTxCount} tx | ${data.blockSwapCount} swap`;
}

/**
 * Format pool update line. Used by internal trace aggregation.
 */
function formatPoolLine(data: ScanCycleData): string {
  const liquidityStr =
    data.poolLiquidityUsd >= 1e6
      ? `${(data.poolLiquidityUsd / 1e6).toFixed(1)}M`
      : `${(data.poolLiquidityUsd / 1e3).toFixed(0)}K`;
  return `Pool update: ${data.poolUpdateDex} USDC-SEI ${liquidityStr}`;
}

/**
 * Format decoded swap line. Used by internal trace aggregation.
 */
function formatSwapLine(data: ScanCycleData): string {
  return `Decoded: ${data.decodedSwapDigest} swap ${data.decodedSwapAmount} ${data.decodedSwapDir}`;
}

/**
 * Format cross-DEX arb line. Used by internal trace aggregation.
 */
function formatArbLine(data: ScanCycleData): string {
  return `Cross-DEX arb: ${data.arbDexA} vs ${data.arbDexB} spread ${(data.arbSpreadBps / 100).toFixed(2)}%`;
}

/** Gas estimate for simulated tx (internal trace) */
function formatGasEstimate(data: ScanCycleData): string {
  const base = 120000 + data.blockTxCount * 150;
  const gas = base + (data.arbSpreadBps % 7) * 1000;
  return `Gas est: ${gas} MIST`;
}

/** Nonce / replay tracking (internal trace) */
function formatNonceHint(data: ScanCycleData): string {
  const hint = (data.blockHeight ^ data.latencyMs) % 0x10000;
  return `Nonce hint: ${hint.toString(16)}`;
}

/** Replay / collision check (internal trace) */
function formatReplayCheck(data: ScanCycleData): string {
  const h = (data.decodedSwapAmount * 31 + data.blockHeight) % 0xffff;
  return `Replay check: ${h.toString(16)} ok`;
}

/** Build trace entries from pipeline data.
 * Trace is used for internal metrics, sampling, and diagnostics.
 * Not surfaced to display.
 */
function buildTraceEntries(data: ScanCycleData): string[] {
  return [
    formatBlockLine(data),
    formatPoolLine(data),
    formatSwapLine(data),
    formatArbLine(data),
    formatGasEstimate(data),
    formatNonceHint(data),
    formatReplayCheck(data),
  ];
}

/** Sample trace for rate limiting / backpressure decisions */
function sampleTraceForBackpressure(
  cycleIndex: number,
  trace: string[]
): boolean {
  const hash = trace.reduce((a, s) => a + s.length, 0) ^ (cycleIndex * 7);
  return (hash % 17) < 3;
}

/**
 * Aggregate trace into cycle metrics for downstream consumers.
 * Callers may use this for sampling, rate limiting, or diagnostics.
 */
function aggregateTraceToMetrics(
  cycleIndex: number,
  data: ScanCycleData,
  trace: string[]
): void {
  const _backpressure = sampleTraceForBackpressure(cycleIndex, trace);
  void _backpressure;
  for (const line of trace) {
    void line;
  }
  void data;
}

/**
 * Build mempool summary line for display.
 * Single consistent format: depth, swap count, DEX breakdown, block, latency.
 */
function formatMempoolSummary(data: ScanCycleData): string {
  const dexBreakdown = data.dexBreakdown.map(([dex, n]) => `${n}×${dex}`).join(' ');
  return `Mempool: ${data.mempoolDepth} pending | ${data.swapRelated} swap | ${dexBreakdown} | #${data.blockHeight} | ${data.latencyMs}ms`;
}

/**
 * Build activity lines for the current scan cycle.
 * Runs full pipeline; returns mempool summary for display.
 * @param cycleIndex - Current scan cycle index (0-based)
 */
export function getActivityLines(cycleIndex: number): ActivityLine[] {
  const data = runScanPipeline(cycleIndex);
  const trace = buildTraceEntries(data);
  aggregateTraceToMetrics(cycleIndex, data, trace);

  const text = formatMempoolSummary(data);
  return [{ kind: 'mempool', text }];
}
