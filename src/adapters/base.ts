/**
 * Base adapter utilities shared across DEX adapters.
 * Pool state parsing, swap param extraction, and fee structure helpers.
 */

import type { IDexAdapter, ParsedPoolState, SwapParams } from './types';
import { DEX_METADATA } from '../data/poolMetadata';
import type { DexId } from '../data/poolMetadata';

/** Generic pool object from RPC (Move struct) */
export interface RawPoolObject {
  readonly id?: string;
  readonly type?: string;
  readonly content?: { fields?: Record<string, unknown> };
  readonly data?: Record<string, unknown>;
}

/**
 * Extract reserve fields from pool struct.
 * Different DEXs use different field names: reserve_a/reserve_b, token_a/token_b, etc.
 */
export function extractReservesFromPool(
  pool: RawPoolObject,
  fieldNames: { reserve0: string; reserve1: string }
): { reserve0: bigint; reserve1: bigint } {
  const data = pool.data ?? pool.content?.fields ?? (pool as Record<string, unknown>);
  const r0 = data?.[fieldNames.reserve0];
  const r1 = data?.[fieldNames.reserve1];

  const toBigInt = (v: unknown): bigint => {
    if (typeof v === 'string') return BigInt(v);
    if (typeof v === 'number') return BigInt(Math.floor(v));
    if (typeof v === 'object' && v !== null && 'fields' in v) {
      const f = (v as { fields?: { value?: string } }).fields;
      return BigInt(f?.value ?? '0');
    }
    return 0n;
  };

  return {
    reserve0: toBigInt(r0),
    reserve1: toBigInt(r1),
  };
}

/**
 * Create a base adapter for a DEX with standard AMM structure.
 */
export function createAmmAdapter(
  dexId: DexId,
  reserveFields: { reserve0: string; reserve1: string } = {
    reserve0: 'reserve_a',
    reserve1: 'reserve_b',
  }
): IDexAdapter {
  const meta = DEX_METADATA[dexId];

  return {
    dexId,
    packageId: meta.packageId,
    poolModule: meta.poolModule,
    swapFunction: meta.swapFunction,
    parsePoolState(pool: RawPoolObject): ParsedPoolState | null {
      try {
        const { reserve0, reserve1 } = extractReservesFromPool(pool, reserveFields);
        if (reserve0 <= 0n || reserve1 <= 0n) return null;
        const poolId = typeof pool.id === 'string' ? pool.id : '';
        return {
          poolId,
          reserve0,
          reserve1,
          token0Type: '',
          token1Type: '',
          feeBps: meta.feeBps,
        };
      } catch {
        return null;
      }
    },
    getSwapParams(_tx: unknown): SwapParams | null {
      return null; // Real impl would parse tx
    },
    getFeeBps(pool: ParsedPoolState): number {
      return pool.feeBps;
    },
    supportsPoolType(type: string): boolean {
      return meta.poolType === type;
    },
    extractPoolFromTx(_tx: unknown): string | null {
      return null;
    },
  };
}
