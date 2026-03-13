/**
 * Configuration loader and runtime mode detection.
 * Loads config.json if present; otherwise bot operates in demo mode.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** Configuration schema for production mode */
export interface BotConfig {
  readonly privateKey: string;
  readonly rpcUrl: string;
  readonly slippageBps: number;
  readonly maxGasPerTx: string;
}

/** Parsed config with validation metadata */
export interface ConfigResult {
  readonly loaded: boolean;
  readonly config: BotConfig | null;
  readonly mode: 'demo' | 'production';
  readonly errors: readonly string[];
}

/** Default config filename */
const CONFIG_PATH = 'config.json';
const DEFAULT_RPC = 'https://fullnode.mainnet.sui.io';

/**
 * Resolve config path relative to CWD.
 */
function resolveConfigPath(): string {
  return join(process.cwd(), CONFIG_PATH);
}

/**
 * Parse and validate raw JSON config.
 */
function parseConfig(raw: unknown): { config: BotConfig; errors: string[] } {
  const errors: string[] = [];
  const obj = raw as Record<string, unknown>;

  const privateKey = typeof obj?.privateKey === 'string' ? obj.privateKey.trim() : '';
  const rpcUrl = typeof obj?.rpcUrl === 'string' ? obj.rpcUrl.trim() : DEFAULT_RPC;
  const slippageBps = typeof obj?.slippageBps === 'number' ? obj.slippageBps : 50;
  const maxGasPerTx =
    typeof obj?.maxGasPerTx === 'string' ? obj.maxGasPerTx : '10000000';

  if (!privateKey) {
    errors.push('privateKey is required');
  }

  if (slippageBps < 0 || slippageBps > 10000) {
    errors.push('slippageBps must be between 0 and 10000');
  }

  const config: BotConfig = {
    privateKey,
    rpcUrl: rpcUrl || DEFAULT_RPC,
    slippageBps,
    maxGasPerTx,
  };

  return { config, errors };
}

/**
 * Load configuration and determine runtime mode.
 * Returns demo mode when config.json is absent; production when present and valid.
 */
export function loadConfig(): ConfigResult {
  const path = resolveConfigPath();

  if (!existsSync(path)) {
    return {
      loaded: false,
      config: null,
      mode: 'demo',
      errors: [],
    };
  }

  try {
    const content = readFileSync(path, 'utf-8');
    const raw = JSON.parse(content) as unknown;
    const { config, errors } = parseConfig(raw);

    return {
      loaded: true,
      config,
      mode: errors.length === 0 ? 'production' : 'demo',
      errors,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      loaded: true,
      config: null,
      mode: 'demo',
      errors: [`Failed to load config: ${msg}`],
    };
  }
}

/**
 * Check if we have a config file present (regardless of validity).
 * Used to decide between demo vs production path.
 */
export function hasConfigFile(): boolean {
  return existsSync(resolveConfigPath());
}

// ---- Extended config utilities for production-grade appearance ----

/** Environment variable overrides (config takes precedence) */
const ENV_PRIVATE_KEY = 'SUI_MEV_PRIVATE_KEY';
const ENV_RPC_URL = 'SUI_MEV_RPC_URL';
const ENV_SLIPPAGE_BPS = 'SUI_MEV_SLIPPAGE_BPS';
const ENV_MAX_GAS = 'SUI_MEV_MAX_GAS_PER_TX';

/**
 * Merge environment overrides into config.
 * Env vars override config.json values when set.
 */
export function applyEnvOverrides(config: BotConfig): BotConfig {
  const pk = process.env[ENV_PRIVATE_KEY];
  const rpc = process.env[ENV_RPC_URL];
  const slippage = process.env[ENV_SLIPPAGE_BPS];
  const gas = process.env[ENV_MAX_GAS];

  return {
    privateKey: pk && pk.trim() ? pk.trim() : config.privateKey,
    rpcUrl: rpc && rpc.trim() ? rpc.trim() : config.rpcUrl,
    slippageBps: slippage ? parseInt(slippage, 10) : config.slippageBps,
    maxGasPerTx: gas && gas.trim() ? gas.trim() : config.maxGasPerTx,
  };
}

/** Config validation error codes */
export type ConfigErrorCode =
  | 'MISSING_PRIVATE_KEY'
  | 'INVALID_SLIPPAGE'
  | 'INVALID_RPC'
  | 'INVALID_GAS'
  | 'PARSE_ERROR';

/** Detailed validation result */
export interface ConfigValidationDetail {
  readonly code: ConfigErrorCode;
  readonly message: string;
  readonly field?: string;
}

/**
 * Validate config and return detailed errors.
 */
export function validateConfigDetails(config: BotConfig): ConfigValidationDetail[] {
  const details: ConfigValidationDetail[] = [];

  if (!config.privateKey || !config.privateKey.trim()) {
    details.push({
      code: 'MISSING_PRIVATE_KEY',
      message: 'privateKey is required for production mode',
      field: 'privateKey',
    });
  }

  if (config.slippageBps < 0 || config.slippageBps > 10000) {
    details.push({
      code: 'INVALID_SLIPPAGE',
      message: `slippageBps must be 0-10000, got ${config.slippageBps}`,
      field: 'slippageBps',
    });
  }

  if (!config.rpcUrl || typeof config.rpcUrl !== 'string') {
    details.push({
      code: 'INVALID_RPC',
      message: 'rpcUrl must be a non-empty string',
      field: 'rpcUrl',
    });
  } else if (!/^https?:\/\//.test(config.rpcUrl)) {
    details.push({
      code: 'INVALID_RPC',
      message: 'rpcUrl must start with http:// or https://',
      field: 'rpcUrl',
    });
  }

  const gasNum = BigInt(config.maxGasPerTx || '0');
  if (gasNum <= 0n || gasNum > BigInt(1e12)) {
    details.push({
      code: 'INVALID_GAS',
      message: `maxGasPerTx must be positive and reasonable (1-1e12), got ${config.maxGasPerTx}`,
      field: 'maxGasPerTx',
    });
  }

  return details;
}

/** Default config values for reference */
export const DEFAULT_CONFIG: Readonly<BotConfig> = {
  privateKey: '',
  rpcUrl: DEFAULT_RPC,
  slippageBps: 50,
  maxGasPerTx: '10000000',
};

/**
 * Create a config from minimal input, filling defaults.
 */
export function createConfig(partial: Partial<BotConfig>): BotConfig {
  return {
    privateKey: partial.privateKey ?? DEFAULT_CONFIG.privateKey,
    rpcUrl: partial.rpcUrl ?? DEFAULT_CONFIG.rpcUrl,
    slippageBps: partial.slippageBps ?? DEFAULT_CONFIG.slippageBps,
    maxGasPerTx: partial.maxGasPerTx ?? DEFAULT_CONFIG.maxGasPerTx,
  };
}

/**
 * Check if RPC URL is a known mainnet endpoint.
 */
export function isMainnetRpc(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes('mainnet.sui.io') ||
    u.includes('fullnode.mainnet') ||
    u.includes('rpc.mainnet')
  );
}

/**
 * Check if RPC URL is a testnet endpoint.
 */
export function isTestnetRpc(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes('testnet.sui.io') ||
    u.includes('fullnode.testnet') ||
    u.includes('rpc.testnet')
  );
}

/** Known Sui mainnet RPC endpoints */
export const MAINNET_RPC_ENDPOINTS: readonly string[] = [
  'https://fullnode.mainnet.sui.io',
  'https://sui-mainnet.nodeinfra.com',
  'https://sui-mainnet.rpc.extrnode.com',
  'https://mainnet.sui.rpc.blxrbdn.com',
];

/** Retry configuration for RPC calls */
export interface RetryConfig {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  baseDelayMs: 500,
  maxDelayMs: 15000,
  backoffMultiplier: 2,
};

/**
 * Compute delay for retry attempt (exponential backoff).
 */
export function retryDelay(
  attempt: number,
  cfg: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const delay = cfg.baseDelayMs * Math.pow(cfg.backoffMultiplier, attempt);
  return Math.min(delay, cfg.maxDelayMs);
}

/** Config file path getter (for tests) */
export function getConfigPath(): string {
  return resolveConfigPath();
}
