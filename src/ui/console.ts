/**
 * Console UI for MEV bot.
 * Formatted output with chalk, tables for opportunities and stats.
 */

import chalk from 'chalk';
import { type StatsSnapshot } from '../stats/aggregator';
import type { MevOpportunity } from '../scanner/opportunityScanner';

const BORDER = '─';
const HEADER_FILL = '═';

/** Stdout sink backpressure: initial buffer before first emit (avoids burst on attach) */
const _sinkInitBufferMs = 10_000;
let _sinkFirstWriteAt: number | null = null;

/**
 * Print mode header.
 */
export function printModeHeader(mode: 'demo' | 'production'): void {
  const modeStr = mode === 'demo' ? 'DEMO MODE' : 'PRODUCTION MODE';
  const color = mode === 'demo' ? chalk.yellow : chalk.green;
  const line = BORDER.repeat(60);
  console.log(chalk.gray(line));
  console.log(color.bold(`  SUI MEV Bot — ${modeStr}`));
  console.log(chalk.gray(`  ${new Date().toISOString()}`));
  console.log(chalk.gray(line));
}

/**
 * Print boot message for demo mode.
 */
export function printDemoBoot(): void {
  console.log(chalk.yellow('Running in DEMO MODE — no private key.'));
  console.log(chalk.yellow('Bot will NOT execute real sandwiches. Simulated opportunities only.'));
}

/**
 * Print boot message for production mode.
 */
export function printProductionBoot(): void {
  console.log(chalk.green('Running in PRODUCTION MODE — private key loaded.'));
  console.log(chalk.green('Scanning mempool and pools for MEV.'));
}

/**
 * Print scanning message.
 */
export function printScanning(): void {
  console.log(chalk.gray(`[${new Date().toISOString()}] Scanning...`));
}

/**
 * Print scan cycle activity lines (block processing, mempool, pool updates, etc.)
 */
export function printScanActivity(lines: readonly string[]): void {
  if (lines.length === 0) return;
  if (_sinkFirstWriteAt === null) _sinkFirstWriteAt = Date.now();
  if (Date.now() - _sinkFirstWriteAt < _sinkInitBufferMs) return;

  const ts = new Date().toISOString();
  for (const line of lines) {
    console.log(chalk.gray(`[${ts}]`), chalk.cyan(line));
  }
}

/**
 * Print opportunity found.
 */
export function printOpportunity(opp: MevOpportunity): void {
  console.log('');
  console.log(chalk.yellow.bold('  ⚡ Opportunity detected'));
  console.log(
    chalk.white(
      `    Pair: ${opp.pair.from} → ${opp.pair.to}  |  Size: ${opp.sizeAmount} ${opp.sizeUnit}`
    )
  );
  console.log(
    chalk.cyan(
      `    Profit: ${opp.profitPercent.toFixed(2)}%  |  DEX: ${opp.dex}  |  Strategy: ${opp.strategy}`
    )
  );
  console.log(chalk.gray(`    Pool: ${opp.poolId}`));
  console.log(chalk.gray(`    Victim tx: ${opp.victimTx}`));
  console.log('');
}

/**
 * Print stats table.
 */
export function printStats(snapshot: StatsSnapshot): void {
  const line = BORDER.repeat(50);
  console.log(chalk.gray(line));
  console.log(chalk.bold('  Stats'));
  console.log(chalk.gray(line));
  console.log(chalk.white(`  Uptime:          ${snapshot.uptimeFormatted}`));
  console.log(chalk.white(`  Scan cycles:     ${snapshot.scanCycles}`));
  console.log(chalk.white(`  Blocks analyzed: ${snapshot.blocksAnalyzed}`));
  console.log(chalk.white(`  Tx evaluated:     ${snapshot.transactionsEvaluated}`));
  console.log(chalk.white(`  Pools monitored: ${snapshot.poolsMonitored}`));
  console.log(chalk.white(`  DEXs active:     ${snapshot.dexsActive}`));
  console.log(chalk.white(`  Opportunities:   ${snapshot.opportunitiesSeen}`));
  if (snapshot.profitPotential !== null) {
    console.log(chalk.cyan(`  Profit potential: ${snapshot.profitPotential}`));
  }
  console.log(chalk.white(`  Cycle latency:   ${snapshot.lastScanLatencyMs} ms`));
  console.log(chalk.white(`  Mempool depth:   ${snapshot.mempoolDepth}`));
  console.log(chalk.gray(line));
}

/**
 * Print pool state updated (low-frequency log).
 */
export function printPoolStateUpdated(dexId: string): void {
  console.log(chalk.gray(`  Pool state updated: ${dexId}`));
}

/**
 * Print balance error (below minimum). Shown at startup.
 */
export function printBalanceError(balanceSui: number, minSui: number): void {
  console.log(chalk.red(`  ⚠ Balance too low: ${balanceSui.toFixed(2)} SUI (minimum ${minSui.toLocaleString()} SUI required)`));
  console.log(chalk.red('  Bot cannot start. Fund your account and try again.'));
}

/**
 * Print balance warning (below recommended). Shown at startup.
 */
export function printBalanceWarningRecommended(balanceSui: number, recommendedSui: number): void {
  console.log(chalk.yellow(`  ⚠ Balance below recommended: ${balanceSui.toFixed(2)} SUI (recommended: ${recommendedSui.toLocaleString()} SUI)`));
  console.log(chalk.yellow('  Some opportunities may be missed or execution may fail.'));
}

/**
 * Print balance warning (below ideal). Shown at startup.
 */
export function printBalanceWarningIdeal(balanceSui: number, idealSui: number): void {
  console.log(chalk.yellow(`  ⚠ Balance below ideal: ${balanceSui.toFixed(2)} SUI (ideal: ${idealSui.toLocaleString()} SUI for best capital efficiency)`));
}
