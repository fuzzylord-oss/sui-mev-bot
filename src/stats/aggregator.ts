/**
 * Stats aggregator.
 * Collects metrics and produces display-ready stats for console UI.
 */

import type { Metrics } from './metrics';
import { formatUptime, POOLS_MONITORED, DEXS_ACTIVE } from './metrics';

/** Stats snapshot for console display */
export interface StatsSnapshot {
  readonly uptimeFormatted: string;
  readonly scanCycles: number;
  readonly blocksAnalyzed: number;
  readonly transactionsEvaluated: number;
  readonly poolsMonitored: number;
  readonly dexsActive: number;
  readonly opportunitiesSeen: number;
  readonly profitPotential: string | null;
  readonly lastScanLatencyMs: number;
  readonly mempoolDepth: number;
}

/** Build display snapshot from metrics */
export function buildStatsSnapshot(m: Metrics, isProduction: boolean): StatsSnapshot {
  return {
    uptimeFormatted: formatUptime(Date.now() - m.startTime),
    scanCycles: m.scanCycles,
    blocksAnalyzed: m.blocksAnalyzed,
    transactionsEvaluated: m.transactionsEvaluated,
    poolsMonitored: POOLS_MONITORED,
    dexsActive: DEXS_ACTIVE,
    opportunitiesSeen: m.opportunitiesSeen,
    profitPotential:
      !isProduction && m.profitPotentialUsd > 0
        ? `$${m.profitPotentialUsd.toFixed(2)}`
        : isProduction
          ? 'N/A'
          : null,
    lastScanLatencyMs: m.lastCycleLatencyMs,
    mempoolDepth: m.mempoolDepth,
  };
}

/** Stats row for display */
export interface StatsRow {
  readonly label: string;
  readonly value: string;
}

/** Build stats table rows from current metrics */
export function buildStatsRows(m: Metrics, isProduction: boolean): StatsRow[] {
  const uptime = formatUptime(Date.now() - m.startTime);

  const rows: StatsRow[] = [
    { label: 'Uptime', value: uptime },
    { label: 'Scan cycles', value: String(m.scanCycles) },
    { label: 'Blocks analyzed', value: String(m.blocksAnalyzed) },
    { label: 'Transactions evaluated', value: String(m.transactionsEvaluated) },
    { label: 'Pools monitored', value: String(POOLS_MONITORED) },
    { label: 'DEXs active', value: String(DEXS_ACTIVE) },
    { label: 'Opportunities seen', value: String(m.opportunitiesSeen) },
    { label: 'Last cycle latency (ms)', value: String(m.lastCycleLatencyMs) },
    { label: 'Mempool depth', value: String(m.mempoolDepth) },
  ];

  if (!isProduction && m.profitPotentialUsd > 0) {
    rows.push({
      label: 'Profit potential (USD)',
      value: m.profitPotentialUsd.toFixed(2),
    });
  } else if (isProduction) {
    rows.push({ label: 'Profit potential', value: 'N/A' });
  }

  return rows;
}
