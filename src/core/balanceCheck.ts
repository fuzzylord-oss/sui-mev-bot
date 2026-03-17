/**
 * Balance check for production mode.
 * Ensures sufficient SUI for sandwich execution (10× victim size rule).
 */

import { SuiClient } from '@mysten/sui/client';

/** 1 SUI = 1e9 MIST */
const MIST_PER_SUI = 1_000_000_000;

/** Minimum balance (SUI) — bot will not start below this */
export const MIN_BALANCE_SUI = 1_000;
/** Recommended balance (SUI) — warning if below */
export const RECOMMENDED_BALANCE_SUI = 3_000;
/** Ideal balance (SUI) — warning if below */
export const IDEAL_BALANCE_SUI = 10_000;

export interface BalanceCheckResult {
  readonly balanceSui: number;
  readonly ok: boolean;
  readonly belowRecommended: boolean;
  readonly belowIdeal: boolean;
}

/**
 * Fetch SUI balance for address and check against thresholds.
 */
export async function checkBalance(
  rpcUrl: string,
  ownerAddress: string
): Promise<BalanceCheckResult> {
  const client = new SuiClient({ url: rpcUrl });
  const balance = await client.getBalance({
    owner: ownerAddress,
    coinType: '0x2::sui::SUI',
  });

  const totalMist = BigInt(balance.totalBalance);
  const balanceSui = Number(totalMist) / MIST_PER_SUI;

  return {
    balanceSui,
    ok: balanceSui >= MIN_BALANCE_SUI,
    belowRecommended: balanceSui < RECOMMENDED_BALANCE_SUI,
    belowIdeal: balanceSui < IDEAL_BALANCE_SUI,
  };
}
