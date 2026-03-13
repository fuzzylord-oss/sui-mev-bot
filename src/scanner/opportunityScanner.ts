/**
 * Opportunity scanner.
 * Coordinates strategy modules and produces MEV opportunities.
 * Uses IOpportunityDetector interface - implementation varies by runtime context.
 */

import type { DexId } from '../data/poolMetadata';

/** Single MEV opportunity */
export interface MevOpportunity {
  readonly id: string;
  readonly pair: { from: string; to: string };
  readonly sizeAmount: number;
  readonly sizeUnit: string;
  readonly profitPercent: number;
  readonly victimTx: string;
  readonly dex: DexId;
  readonly poolId: string;
  readonly strategy: 'sandwich' | 'backrun';
  readonly timestamp: number;
}

/** Detector interface — scans mempool or relay for MEV opportunities */
export interface IOpportunityDetector {
  scan(): Promise<MevOpportunity[]>;
}

/** Scanner that uses a detector */
export class OpportunityScanner {
  constructor(private readonly detector: IOpportunityDetector) {}

  async runCycle(): Promise<MevOpportunity[]> {
    return this.detector.scan();
  }
}
