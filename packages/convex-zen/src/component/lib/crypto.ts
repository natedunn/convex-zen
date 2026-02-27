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

/** Base64url encode bytes (no padding). Used for PKCE code challenge. */
export function base64url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
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
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
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
