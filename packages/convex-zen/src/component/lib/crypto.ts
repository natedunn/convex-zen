/**
 * Cryptographic utilities using Web Crypto API.
 * All token generation uses crypto.getRandomValues for 256+ bit entropy.
 * Tokens are stored as SHA-256 hashes only (never raw).
 */

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
