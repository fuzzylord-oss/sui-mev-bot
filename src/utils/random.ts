/**
 * Sampling utilities for probabilistic parameters.
 * Weighted choice, distribution sampling, address generation.
 */

/** Sample from uniform distribution in [min, max] */
export function uniform(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Sample integer in [min, max] inclusive */
export function uniformInt(min: number, max: number): number {
  return Math.floor(uniform(min, max + 0.999999));
}

/** Weighted choice: pick index by weights (normalized) */
export function weightedChoice<T>(items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Sample from distribution (approximate normal via Box-Muller) */
export function sampleFromDistribution(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  if (u1 < 1e-10) return mean;
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stdDev * z;
}

/** Pick random element from array */
export function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Generate random hex string of given byte length */
export function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return '0x' + Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Random Sui address (0x + 64 hex chars). Used for tx and pool ID generation. */
export function randomSuiAddress(): string {
  return randomHex(32);
}

/** Random interval in ms between minMs and maxMs (e.g. 60_000–300_000 for 1–5 min) */
export function randomIntervalMs(minMs: number, maxMs: number): number {
  return uniformInt(minMs, maxMs);
}
