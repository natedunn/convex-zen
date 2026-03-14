/**
 * Cryptographic utilities using Web Crypto API.
 * All token generation uses crypto.getRandomValues for 256+ bit entropy.
 * Tokens are stored as SHA-256 hashes only (never raw).
 */

const ENCRYPTED_VALUE_PREFIX = "enc:v1:";
const AES_GCM_IV_BYTES = 12;
const MIN_ENCRYPTION_SECRET_LENGTH = 16;

/** Generate a cryptographically secure 32-byte random hex token (256 bits). */
export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** SHA-256 hash a string token, returns hex string. */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Convert a Uint8Array to a base64 string without using spread arguments.
 *
 * The spread form `btoa(String.fromCharCode(...bytes))` passes every byte as a
 * separate function argument. JavaScript engines impose a per-call argument
 * limit (≈65 536 in V8) and the Convex component runtime runs in a sandboxed
 * V8 isolate where that limit may be lower. This loop-based implementation has
 * no argument-count limit and is safe for inputs of any size (e.g. large OAuth
 * JWT access tokens issued by enterprise identity providers).
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** Base64url encode bytes (no padding). Used for PKCE code challenge. */
export function base64url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/** Generate a PKCE code verifier (32 random bytes, base64url encoded). */
export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/** Generate a PKCE code challenge (SHA-256 of verifier, base64url encoded). */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return base64url(new Uint8Array(hashBuffer));
}

/**
 * Generate a cryptographically secure 8-character alphanumeric code.
 * Uses rejection sampling to avoid modulo bias.
 * Charset: A-Z, 0-9 (36 chars) — avoids ambiguous chars like 0/O, 1/I/l.
 */
export function generateCode(): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 chars, power of 2
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => charset[b & 31]) // 32 = 2^5, no bias since 256 / 32 = 8 exactly
    .join("");
}

/** Generate a 32-byte random state token for OAuth (returned as hex). */
export function generateState(): string {
  return generateToken();
}

/**
 * Compare two strings in constant time to prevent timing attacks.
 * Runs for max(a.length, b.length) iterations regardless of input so that
 * neither string length nor the position of the first mismatch is revealed
 * through execution time.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const lenA = a.length;
  const lenB = b.length;
  const len = Math.max(lenA, lenB);
  // Encode length difference into result from the start so differing lengths
  // always produce a non-zero result without an early return.
  let result = lenA ^ lenB;
  for (let i = 0; i < len; i++) {
    const ca = i < lenA ? a.charCodeAt(i) : 0;
    const cb = i < lenB ? b.charCodeAt(i) : 0;
    result |= ca ^ cb;
  }
  return result === 0;
}

function assertEncryptionSecret(secret: string): string {
  const trimmed = secret.trim();
  if (trimmed.length < MIN_ENCRYPTION_SECRET_LENGTH) {
    throw new Error(
      `Encryption secret must be at least ${MIN_ENCRYPTION_SECRET_LENGTH} characters`
    );
  }
  return trimmed;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded =
    normalized.length % 4 === 0
      ? normalized
      : normalized + "=".repeat(4 - (normalized.length % 4));
  const decoded = atob(padded);
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

async function deriveAesGcmKey(secret: string): Promise<CryptoKey> {
  const secretBytes = new TextEncoder().encode(assertEncryptionSecret(secret));
  const keyMaterial = await crypto.subtle.digest("SHA-256", secretBytes);
  return crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a string as AES-GCM ciphertext and return a tagged encoded value.
 * Intended for sensitive persisted fields (oauth tokens, etc).
 */
export async function encryptString(
  plaintext: string,
  secret: string
): Promise<string> {
  const key = await deriveAesGcmKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  const payload = new Uint8Array(iv.length + ciphertext.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(ciphertext), iv.length);
  return `${ENCRYPTED_VALUE_PREFIX}${bytesToBase64Url(payload)}`;
}

/**
 * Decrypt a tagged AES-GCM value. Untagged values are returned as-is to
 * preserve backwards compatibility with plaintext historical rows.
 */
export async function decryptString(
  value: string,
  secret: string
): Promise<string> {
  if (!value.startsWith(ENCRYPTED_VALUE_PREFIX)) {
    return value;
  }
  const encodedPayload = value.slice(ENCRYPTED_VALUE_PREFIX.length);
  const payload = base64UrlToBytes(encodedPayload);
  if (payload.length <= AES_GCM_IV_BYTES) {
    throw new Error("Invalid encrypted payload");
  }
  const iv = payload.slice(0, AES_GCM_IV_BYTES);
  const ciphertext = payload.slice(AES_GCM_IV_BYTES);
  const key = await deriveAesGcmKey(secret);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}
