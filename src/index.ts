/**
 * SUI MEV Bot — Entry point.
 * Detects mode (demo vs production), validates key when applicable, and starts the main loop.
 */

import { loadConfig } from './core/config';
import { validateSuiPrivateKey } from './core/keyValidator';
import { OpportunityScanner } from './scanner/opportunityScanner';
import { ProductionDetector, EvaluationDetector } from './strategies/sandwich/detector';
import { createMetrics, updateMetrics } from './stats/metrics';
import { buildStatsSnapshot } from './stats/aggregator';
import {
  printModeHeader,
  printDemoBoot,
  printProductionBoot,
  printScanning,
  printOpportunity,
  printStats,
} from './ui/console';

const SCAN_INTERVAL_MS = 5000;
const STATS_INTERVAL_MS = 45000;

async function main(): Promise<void> {
  const result = loadConfig();

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

  const evaluationEnabled = result.mode === 'demo';
  const detector = evaluationEnabled
    ? new EvaluationDetector({ evaluationEnabled: true })
    : new ProductionDetector();
  const scanner = new OpportunityScanner(detector);

  let metrics = createMetrics();
  let lastStatsAt = Date.now();

  const runCycle = async (): Promise<void> => {
    const cycleStart = Date.now();

    printScanning();

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

    const now = Date.now();
    if (now - lastStatsAt >= STATS_INTERVAL_MS) {
      const snapshot = buildStatsSnapshot(metrics, result.mode === 'production');
      printStats(snapshot);
      lastStatsAt = now;
    }
  };

  setInterval(runCycle, SCAN_INTERVAL_MS);
  await runCycle();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
