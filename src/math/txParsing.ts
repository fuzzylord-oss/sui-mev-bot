/**
 * Transaction Parsing Mathematics
 *
 * BCS/bytes decoding helpers, offset calculations, variable-length field extraction,
 * swap argument extraction, gas budget estimation from tx structure.
 *
 * Sui/Move transaction layout and type parsing for MEV detection.
 */

import type { DexId } from '../data/poolMetadata';

/** Fixed offsets in Sui BCS transaction layout */
export const TX_HEADER_SIZE = 1; // Transaction kind discriminant
export const SENDER_OFFSET = 0;
export const GAS_OBJECT_OFFSET = 32;
export const ARGUMENTS_START = 64;

/** BCS type layout constants */
export const U8_SIZE = 1;
export const U16_SIZE = 2;
export const U32_SIZE = 4;
export const U64_SIZE = 8;
export const U128_SIZE = 16;
export const ADDRESS_SIZE = 32;
export const BOOL_SIZE = 1;

/** Extracted swap call arguments */
export interface SwapCallArgs {
  readonly amountIn: bigint;
  readonly amountOutMin: bigint;
  readonly path: readonly string[];
  readonly deadline?: number;
  readonly poolId: string;
  readonly tokenIn: string;
  readonly tokenOut: string;
  readonly dexId: DexId;
}

/** Gas complexity estimate from tx structure */
export interface TxComplexityEstimate {
  readonly inputCount: number;
  readonly typeArgCount: number;
  readonly pureArgCount: number;
  readonly objectArgCount: number;
  readonly estimatedGasUnits: bigint;
  readonly hasDynamicFields: boolean;
}

/** Decoded pool reference from transaction */
export interface PoolReference {
  readonly poolId: string;
  readonly dexPackage: string;
  readonly moduleName: string;
}

/**
 * Read ULEB128-encoded unsigned integer from bytes.
 * Used for length prefixes in BCS.
 *
 * @param data - Buffer
 * @param offset - Start offset
 * @returns [value, bytesRead]
 */
export function readUleb128(data: Uint8Array, offset: number): [number, number] {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;

  for (let i = offset; i < data.length; i++) {
    const byte = data[i]!;
    bytesRead++;
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
    if (shift >= 35) throw new Error('ULEB128 overflow');
  }

  return [value, bytesRead];
}

/**
 * Compute byte offset for variable-length vector in BCS.
 * Vector layout: length (ULEB128) + length * element_size
 */
export function vectorOffset(
  data: Uint8Array,
  offset: number,
  elementSizeFn: (data: Uint8Array, off: number) => number
): { start: number; end: number; length: number } {
  const [length, lenBytes] = readUleb128(data, offset);
  let current = offset + lenBytes;
  const start = current;

  for (let i = 0; i < length; i++) {
    const elemSize = elementSizeFn(data, current);
    current += elemSize;
  }

  return { start, end: current, length };
}

/**
 * Extract 32-byte address from bytes at offset.
 */
export function extractAddress(data: Uint8Array, offset: number): string {
  if (offset + ADDRESS_SIZE > data.length) {
    throw new Error('Address extract out of bounds');
  }
  const bytes = data.slice(offset, offset + ADDRESS_SIZE);
  return '0x' + Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Extract U64 from little-endian bytes.
 */
export function extractU64(data: Uint8Array, offset: number): bigint {
  if (offset + U64_SIZE > data.length) {
    throw new Error('U64 extract out of bounds');
  }
  let value = 0n;
  for (let i = U64_SIZE - 1; i >= 0; i--) {
    value = (value << 8n) | BigInt(data[offset + i]!);
  }
  return value;
}

/**
 * Decode swap call arguments from Move function call bytes.
 * Assumes common layout: (pool, amount_in, min_out, path?)
 */
export function decodeSwapCallArgs(
  data: Uint8Array,
  packageId: string,
  moduleName: string,
  dexId: DexId
): SwapCallArgs | null {
  try {
    let offset = 0;

    // First arg: ObjectID (pool)
    const poolId = extractAddress(data, offset);
    offset += ADDRESS_SIZE;

    // Second arg: U64 (amount_in)
    const amountIn = extractU64(data, offset);
    offset += U64_SIZE;

    // Third arg: U64 (min_out)
    const amountOutMin = extractU64(data, offset);
    offset += U64_SIZE;

    // Optional: path vector
    const path: string[] = [];
    if (offset < data.length) {
      const [pathLen, pathLenBytes] = readUleb128(data, offset);
      offset += pathLenBytes;
      for (let i = 0; i < pathLen && offset + ADDRESS_SIZE <= data.length; i++) {
        path.push(extractAddress(data, offset));
        offset += ADDRESS_SIZE;
      }
    }

    return {
      amountIn,
      amountOutMin,
      path,
      poolId,
      tokenIn: '',
      tokenOut: '',
      dexId,
    };
  } catch {
    return null;
  }
}

/**
 * Estimate gas complexity from transaction structure.
 * More inputs and type args => higher gas.
 */
export function estimateTxComplexity(
  inputCount: number,
  typeArgCount: number,
  pureArgCount: number,
  objectArgCount: number,
  hasDynamicFields: boolean
): TxComplexityEstimate {
  const baseGas = 1000n;
  const perInput = 150n;
  const perTypeArg = 50n;
  const perPureArg = 20n;
  const perObjectArg = 100n;
  const dynamicMultiplier = hasDynamicFields ? 2n : 1n;

  const estimatedGasUnits =
    (baseGas +
      BigInt(inputCount) * perInput +
      BigInt(typeArgCount) * perTypeArg +
      BigInt(pureArgCount) * perPureArg +
      BigInt(objectArgCount) * perObjectArg) *
    dynamicMultiplier;

  return {
    inputCount,
    typeArgCount,
    pureArgCount,
    objectArgCount,
    estimatedGasUnits,
    hasDynamicFields,
  };
}

/**
 * Extract pool reference from transaction by matching package/module.
 */
export function extractPoolFromTx(
  txBytes: Uint8Array,
  knownPackages: ReadonlyArray<{ packageId: string; module: string; dexId: DexId }>
): PoolReference | null {
  // Convert to hex string for pattern matching
  const hex = Array.from(txBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  for (const { packageId, module, dexId } of knownPackages) {
    const pkgHex = packageId.replace(/^0x/, '');
    const idx = hex.indexOf(pkgHex);
    if (idx >= 0) {
      const addressStart = Math.floor(idx / 2);
      if (addressStart + ADDRESS_SIZE <= txBytes.length) {
        const poolId = extractAddress(txBytes, addressStart);
        return { poolId, dexPackage: packageId, moduleName: module };
      }
    }
  }
  return null;
}

/**
 * Compute struct layout offset for nested Move struct.
 * Struct layout: discriminator (if enum) + field0 + field1 + ...
 */
export function structFieldOffset(
  fieldIndex: number,
  fieldSizes: readonly number[]
): number {
  let offset = 0;
  for (let i = 0; i < fieldIndex && i < fieldSizes.length; i++) {
    offset += fieldSizes[i]!;
  }
  return offset;
}

/**
 * Parse BCS discriminant for enum (1 byte).
 */
export function parseDiscriminant(data: Uint8Array, offset: number): number {
  if (offset >= data.length) throw new Error('Discriminant out of bounds');
  return data[offset]!;
}

/**
 * Variable-length BCS string size (length prefix + bytes).
 */
export function bcsStringSize(data: Uint8Array, offset: number): number {
  const [length, lenBytes] = readUleb128(data, offset);
  return lenBytes + length;
}

/**
 * Type argument layout: vector of type tags.
 * Each tag: length (ULEB) + bytes
 */
export function typeArgByteSize(data: Uint8Array, offset: number): number {
  const [tagLen, tagLenBytes] = readUleb128(data, offset);
  return tagLenBytes + tagLen;
}
