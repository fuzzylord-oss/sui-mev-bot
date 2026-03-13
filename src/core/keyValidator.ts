/**
 * SUI private key validation and format conversion utilities.
 * Supports Bech32 (suiprivkey...), hex, and raw bytes.
 * Validates via @mysten/sui keypair derivation.
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Secp256k1Keypair } from '@mysten/sui/keypairs/secp256k1';
import { Secp256r1Keypair } from '@mysten/sui/keypairs/secp256r1';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import type { Keypair } from '@mysten/sui/cryptography';

/** Scheme types supported by Sui */
export type SuiSignatureScheme = 'ED25519' | 'Secp256k1' | 'Secp256r1';

/** Result of key validation with optional address derivation */
export interface KeyValidationResult {
  readonly valid: boolean;
  readonly scheme?: SuiSignatureScheme;
  readonly address?: string;
  readonly error?: string;
}

const HEX_PREFIX = '0x';
const SUI_PRIVKEY_PREFIX = 'suiprivkey';
const ED25519_SECRET_LEN = 32;

/**
 * Normalize hex string: strip 0x, ensure even length, lowercase.
 */
function normalizeHex(hex: string): string {
  let s = hex.trim().toLowerCase();
  if (s.startsWith(HEX_PREFIX)) {
    s = s.slice(HEX_PREFIX.length);
  }
  if (s.length % 2 !== 0) {
    s = '0' + s;
  }
  return s;
}

/**
 * Convert hex string to Uint8Array.
 * @throws if string contains non-hex characters
 */
function hexToBytes(hex: string): Uint8Array {
  const normalized = normalizeHex(hex);
  const len = normalized.length / 2;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const byte = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error('Invalid hex character');
    }
    out[i] = byte;
  }
  return out;
}

/**
 * Check if string looks like hex (0x + hex chars or just hex).
 */
function isHexLike(s: string): boolean {
  const t = s.trim().toLowerCase();
  if (t.startsWith(HEX_PREFIX)) {
    return /^0x[0-9a-f]+$/.test(t);
  }
  return /^[0-9a-f]+$/.test(t);
}

/**
 * Check if string is Bech32-encoded Sui private key.
 */
function isBech32SuiKey(s: string): boolean {
  const t = s.trim().toLowerCase();
  return t.startsWith(SUI_PRIVKEY_PREFIX + '1');
}

/**
 * Validate key from Bech32 format using decodeSuiPrivateKey and appropriate Keypair.
 */
function validateBech32(key: string): KeyValidationResult {
  try {
    const decoded = decodeSuiPrivateKey(key);
    const scheme = decoded.scheme as SuiSignatureScheme;

    let kp: Keypair;
    switch (scheme) {
      case 'ED25519':
        kp = Ed25519Keypair.fromSecretKey(decoded.secretKey);
        break;
      case 'Secp256k1':
        kp = Secp256k1Keypair.fromSecretKey(decoded.secretKey);
        break;
      case 'Secp256r1':
        kp = Secp256r1Keypair.fromSecretKey(decoded.secretKey);
        break;
      default:
        return { valid: false, error: `Unsupported scheme: ${scheme}` };
    }

    const address = kp.toSuiAddress();
    return { valid: true, scheme, address };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { valid: false, error: msg };
  }
}

/**
 * Try to construct keypair from raw bytes (hex-decoded).
 * Attempts ED25519, Secp256k1, Secp256r1 in order.
 */
function validateRawBytes(bytes: Uint8Array): KeyValidationResult {
  if (bytes.length === ED25519_SECRET_LEN) {
    try {
      const kp = Ed25519Keypair.fromSecretKey(bytes);
      return { valid: true, scheme: 'ED25519', address: kp.toSuiAddress() };
    } catch {
      // fall through
    }
    try {
      const kp = Secp256k1Keypair.fromSecretKey(bytes);
      return { valid: true, scheme: 'Secp256k1', address: kp.toSuiAddress() };
    } catch {
      // fall through
    }
    try {
      const kp = Secp256r1Keypair.fromSecretKey(bytes);
      return { valid: true, scheme: 'Secp256r1', address: kp.toSuiAddress() };
    } catch {
      // fall through
    }
  }

  return { valid: false, error: 'Invalid key length or format' };
}

/**
 * Main entry: validate a Sui private key.
 * Returns true iff the key can be parsed and used to derive a valid keypair.
 */
export function validateSuiPrivateKey(key: string): boolean {
  if (!key || typeof key !== 'string') {
    return false;
  }

  const trimmed = key.trim();
  if (!trimmed) {
    return false;
  }

  if (isBech32SuiKey(trimmed)) {
    return validateBech32(trimmed).valid;
  }

  if (isHexLike(trimmed)) {
    try {
      const bytes = hexToBytes(trimmed);
      return validateRawBytes(bytes).valid;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Full validation with scheme and address extraction.
 */
export function validateAndParseSuiPrivateKey(key: string): KeyValidationResult {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'Key is required' };
  }

  const trimmed = key.trim();
  if (!trimmed) {
    return { valid: false, error: 'Key is empty' };
  }

  if (isBech32SuiKey(trimmed)) {
    return validateBech32(trimmed);
  }

  if (isHexLike(trimmed)) {
    try {
      const bytes = hexToBytes(trimmed);
      return validateRawBytes(bytes);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { valid: false, error: msg };
    }
  }

  return { valid: false, error: 'Unknown key format' };
}
