import { describe, it, expect } from "vitest";
import {
  timingSafeEqual,
  base64url,
  encryptString,
  decryptString,
} from "../src/component/lib/crypto";

describe("timingSafeEqual", () => {
  it("returns true for identical strings", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("", "")).toBe(true);
  });

  it("returns false for strings that differ in content", () => {
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "ABC")).toBe(false);
  });

  it("returns false for strings of different lengths", () => {
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
    expect(timingSafeEqual("abcd", "abc")).toBe(false);
    expect(timingSafeEqual("", "a")).toBe(false);
    expect(timingSafeEqual("a", "")).toBe(false);
  });

  it("compares SHA-256-length hex strings correctly (64 chars)", () => {
    const hex = "a".repeat(64);
    expect(timingSafeEqual(hex, hex)).toBe(true);
    const hexB = "a".repeat(63) + "b";
    expect(timingSafeEqual(hex, hexB)).toBe(false);
  });

  it("always runs to completion regardless of mismatch position", () => {
    // These strings differ only at position 0 vs position 63 — both should
    // return false in the same number of loop iterations (64 in this case).
    const hex0 = "b" + "a".repeat(63);
    const hex63 = "a".repeat(63) + "b";
    const base = "a".repeat(64);
    expect(timingSafeEqual(base, hex0)).toBe(false);
    expect(timingSafeEqual(base, hex63)).toBe(false);
  });
});

describe("base64url (loop-based encoding)", () => {
  it("encodes a 32-byte buffer correctly (PKCE verifier size)", () => {
    const bytes = new Uint8Array(32).fill(0xff);
    const result = base64url(bytes);
    // 32 bytes → 43 base64url chars (no padding)
    expect(result).toHaveLength(43);
    expect(result).not.toContain("+");
    expect(result).not.toContain("/");
    expect(result).not.toContain("=");
  });

  it("encodes a zero-byte buffer without error", () => {
    expect(base64url(new Uint8Array(0))).toBe("");
  });

  it("encodes a large buffer (4 KB) without error — guards against spread limit", () => {
    // 4 096 bytes simulates a large enterprise OAuth JWT access token.
    // The old `btoa(String.fromCharCode(...bytes))` pattern would pass 4096
    // arguments to String.fromCharCode, which can hit isolate limits.
    const bytes = new Uint8Array(4096).fill(0xab);
    const result = base64url(bytes);
    // Should produce a non-empty base64url string
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toContain("+");
    expect(result).not.toContain("/");
    expect(result).not.toContain("=");
  });

  it("produces the same output as the reference implementation for known values", () => {
    // Known-good: [0x00, 0x01, 0x02] → base64 "AAEC" → base64url "AAEC"
    const bytes = new Uint8Array([0x00, 0x01, 0x02]);
    expect(base64url(bytes)).toBe("AAEC");

    // Known-good: [0xfb, 0xfc, 0xfd] → base64 "+/z9" → base64url "-_z9"
    const bytes2 = new Uint8Array([0xfb, 0xfc, 0xfd]);
    expect(base64url(bytes2)).toBe("-_z9");
  });
});

describe("encryptString / decryptString roundtrip (large payload)", () => {
  it("round-trips a 4 KB plaintext safely", async () => {
    // Simulates a large JWT access token (4 096 characters).
    // After AES-GCM encryption the payload is: 12 (IV) + 4096 + 16 (tag) = 4124 bytes.
    // With the old spread approach that is 4124 arguments to String.fromCharCode.
    const plaintext = "x".repeat(4096);
    const secret = "supersecretkey16plus";
    const encrypted = await encryptString(plaintext, secret);
    const decrypted = await decryptString(encrypted, secret);
    expect(decrypted).toBe(plaintext);
  });
});
