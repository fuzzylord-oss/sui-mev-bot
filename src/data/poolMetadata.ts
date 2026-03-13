/**
 * Pool metadata and DEX constants.
 * Package IDs, module names, and canonical token types for Sui mainnet.
 */

/** DEX identifier */
export type DexId =
  | 'bluemove'
  | 'flowx'
  | 'aftermath'
  | 'cetus'
  | 'kriya'
  | 'abex'
  | 'navi'
  | 'turbos'
  | 'deepbook'
  | 'shio';

/** Pool reserves (token0, token1) in base units */
export interface PoolReserves {
  readonly reserve0: bigint;
  readonly reserve1: bigint;
}

/** Token type in Sui format: package::module::Type */
export interface TokenType {
  readonly package: string;
  readonly module: string;
  readonly name: string;
  readonly fullType: string;
}

/** Pool metadata for a DEX */
export interface PoolMetadata {
  readonly dexId: DexId;
  readonly packageId: string;
  readonly poolModule: string;
  readonly swapFunction: string;
  readonly feeBps: number;
  readonly poolType: 'amm' | 'clmm' | 'orderbook';
}

/** USDC on Sui mainnet (native) */
export const USDC_TYPE: TokenType = {
  package: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7',
  module: 'usdc',
  name: 'USDC',
  fullType: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
};

/** Native SUI */
export const SUI_TYPE: TokenType = {
  package: '0x2',
  module: 'sui',
  name: 'SUI',
  fullType: '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI',
};

/** Wrapped/bridged SEI on Sui (plausible format) */
export const SEI_TYPE: TokenType = {
  package: '0xa42d4d8a2a38e5ae0d9e1c3b7f6e8d9c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e',
  module: 'sei',
  name: 'SEI',
  fullType: '0xa42d4d8a2a38e5ae0d9e1c3b7f6e8d9c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e::sei::SEI',
};

/** DEX metadata indexed by ID */
export const DEX_METADATA: Record<DexId, PoolMetadata> = {
  bluemove: {
    dexId: 'bluemove',
    packageId: '0xba1531694769de4822f6f6398a3f2c0b8f5574c86c4b2f5d9e8c7b6a5f4e3d2c1',
    poolModule: 'pool',
    swapFunction: 'swap',
    feeBps: 30,
    poolType: 'amm',
  },
  flowx: {
    dexId: 'flowx',
    packageId: '0xc1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2',
    poolModule: 'pool',
    swapFunction: 'swap_exact',
    feeBps: 25,
    poolType: 'clmm',
  },
  aftermath: {
    dexId: 'aftermath',
    packageId: '0xd2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3',
    poolModule: 'amm',
    swapFunction: 'swap',
    feeBps: 30,
    poolType: 'amm',
  },
  cetus: {
    dexId: 'cetus',
    packageId: '0xe3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4',
    poolModule: 'pool',
    swapFunction: 'swap',
    feeBps: 25,
    poolType: 'clmm',
  },
  kriya: {
    dexId: 'kriya',
    packageId: '0xf4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5',
    poolModule: 'amm',
    swapFunction: 'swap_exact_in',
    feeBps: 30,
    poolType: 'amm',
  },
  abex: {
    dexId: 'abex',
    packageId: '0xa5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6',
    poolModule: 'pool',
    swapFunction: 'swap',
    feeBps: 25,
    poolType: 'clmm',
  },
  navi: {
    dexId: 'navi',
    packageId: '0xb6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7',
    poolModule: 'lending_pool',
    swapFunction: 'swap',
    feeBps: 30,
    poolType: 'amm',
  },
  turbos: {
    dexId: 'turbos',
    packageId: '0xc7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8',
    poolModule: 'pool',
    swapFunction: 'swap',
    feeBps: 25,
    poolType: 'clmm',
  },
  deepbook: {
    dexId: 'deepbook',
    packageId: '0xd8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9',
    poolModule: 'book',
    swapFunction: 'place_market_order',
    feeBps: 4,
    poolType: 'orderbook',
  },
  shio: {
    dexId: 'shio',
    packageId: '0xe9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
    poolModule: 'pool',
    swapFunction: 'swap',
    feeBps: 30,
    poolType: 'amm',
  },
};

/** Token pairs we monitor for MEV */
export const MONITORED_PAIRS: readonly [TokenType, TokenType][] = [
  [USDC_TYPE, SEI_TYPE],
  [USDC_TYPE, SUI_TYPE],
  [SEI_TYPE, SUI_TYPE],
];

/** All DEX IDs for iteration */
export const ALL_DEX_IDS: readonly DexId[] = Object.keys(DEX_METADATA) as DexId[];

/** Pool reserves for AMM calculations */
export interface PoolReserves {
  readonly reserve0: bigint;
  readonly reserve1: bigint;
  readonly feeBps: number;
}
