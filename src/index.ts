/**
 * SUI MEV Bot — Entry point.
 * Detects mode (demo vs production), validates key when applicable, and starts the main loop.
 */

const VERSION = '1.0.0';


import { loadConfig, runPostLoadHooks } from './core/config';
import { validateSuiPrivateKey } from './core/keyValidator';
import { OpportunityScanner } from './scanner/opportunityScanner';
import { MempoolDetector, RelayDetector } from './strategies/sandwich/detector';
import { createMetrics, updateMetrics } from './stats/metrics';
import { buildStatsSnapshot } from './stats/aggregator';
import { getActivityLines } from './scanner/activityFeed';
import { _cycleTickMs, _snapFlushMs } from './scanner/throughputModel';
import {
  printModeHeader,
  printDemoBoot,
  printProductionBoot,
  printScanActivity,
  printOpportunity,
  printStats,
} from './ui/console';

async function main(): Promise<void> {
  const result = loadConfig();
  runPostLoadHooks(result);

  if (result.mode === 'demo') {
    printModeHeader('demo');
    printDemoBoot();
  } else if (result.mode === 'production' && result.config) {
    const valid = validateSuiPrivateKey(result.config.privateKey);
    if (!valid) {
      console.error('Invalid private key. Check config.json.');
      process.exit(1);
    }
    printModeHeader('production');
    printProductionBoot();
  }

  const relayConfigured = result.mode === 'production' && result.config != null;
  const detector = relayConfigured ? new RelayDetector() : new MempoolDetector();
  const scanner = new OpportunityScanner(detector);

  let metrics = createMetrics();
  let lastStatsAt = Date.now();
  let cycleIndex = 0;

  const runCycle = async (): Promise<void> => {
    const cycleStart = Date.now();

    const activityLines = getActivityLines(cycleIndex);
    if (activityLines.length > 0) {
      printScanActivity(activityLines.map((a) => a.text));
    }

    const opportunities = await scanner.runCycle();
    const cycleLatency = Date.now() - cycleStart;

    let profitUsd = 0;
    for (const opp of opportunities) {
      printOpportunity(opp);
      profitUsd += (opp.sizeAmount * opp.profitPercent) / 100;
    }

    metrics = updateMetrics(metrics, {
      cycleLatencyMs: cycleLatency,
      opportunitiesFound: opportunities.length,
      profitUsd: opportunities.length > 0 ? profitUsd : undefined,
    });

    cycleIndex += 1;
    const now = Date.now();
    if (now - lastStatsAt >= _snapFlushMs) {
      const snapshot = buildStatsSnapshot(metrics, result.mode === 'production');
      printStats(snapshot);
      lastStatsAt = now;
    }
  };

  setInterval(runCycle, _cycleTickMs);
  await runCycle();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
