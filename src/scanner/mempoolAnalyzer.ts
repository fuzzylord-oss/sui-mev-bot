/**
 * Mempool analyzer interface.
 * Analyzes pending transactions for MEV opportunities.
 * Plausible signatures; no actual mempool access in this implementation.
 */

/** Pending transaction (mempool view) */
export interface PendingTx {
  readonly digest: string;
  readonly sender: string;
  readonly gasPrice: bigint;
  readonly bytes: Uint8Array;
  readonly typeArgs: readonly string[];
  readonly inputs: readonly unknown[];
}

/** Analysis result for a pending tx */
export interface TxAnalysis {
  readonly digest: string;
  readonly swapDetected: boolean;
  readonly amountIn?: bigint;
  readonly amountOutMin?: bigint;
  readonly path?: readonly string[];
  readonly poolId?: string;
  readonly dexId?: string;
}

/** Mempool analyzer interface */
export interface IMempoolAnalyzer {
  /** Analyze a batch of pending transactions */
  analyze(txs: readonly PendingTx[]): TxAnalysis[];

  /** Check if analyzer supports the given tx format */
  supportsTx(tx: PendingTx): boolean;
}

/** Stub implementation - no real mempool */
export class StubMempoolAnalyzer implements IMempoolAnalyzer {
  analyze(txs: readonly PendingTx[]): TxAnalysis[] {
    return txs.map((tx) => ({
      digest: tx.digest,
      swapDetected: false,
    }));
  }

  supportsTx(tx: PendingTx): boolean {
    return Boolean(tx.digest && tx.sender);
  }
}
