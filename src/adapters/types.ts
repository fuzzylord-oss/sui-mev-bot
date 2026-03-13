/**
 * DEX adapter interface and shared types.
 * Each DEX implements IDexAdapter for pool state parsing and swap param extraction.
 */

import type { DexId } from '../data/poolMetadata';

/** Parsed pool state from DEX-specific object */
export interface ParsedPoolState {
  readonly poolId: string;
  readonly reserve0: bigint;
  readonly reserve1: bigint;
  readonly token0Type: string;
  readonly token1Type: string;
  readonly feeBps: number;
  readonly liquidity?: bigint;
  readonly sqrtPriceX96?: bigint;
  readonly tickCurrent?: number;
}

/** Extracted swap parameters from a transaction */
export interface SwapParams {
  readonly amountIn: bigint;
  readonly amountOutMin: bigint;
  readonly path: readonly string[];
  readonly deadline?: number;
  readonly recipient?: string;
}

/** DEX adapter interface */
export interface IDexAdapter {
  readonly dexId: DexId;
  readonly packageId: string;
  readonly poolModule: string;
  readonly swapFunction: string;

  /** Parse pool object from chain to standardized state */
  parsePoolState(poolObj: unknown): ParsedPoolState | null;

  /** Extract swap params from transaction data */
  getSwapParams(tx: unknown): SwapParams | null;

  /** Get fee in basis points for pool type */
  getFeeBps(pool: ParsedPoolState): number;

  /** Check if this adapter supports the given pool type */
  supportsPoolType(typeStr: string): boolean;

  /** Decode pool ID from transaction if applicable */
  extractPoolFromTx(tx: unknown): string | null;
}

/** Registry of adapters by DEX ID */
export type AdapterRegistry = Map<DexId, IDexAdapter>;
