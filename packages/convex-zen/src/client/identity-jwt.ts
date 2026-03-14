import { p256 } from "@noble/curves/p256";
import { sha256 } from "@noble/hashes/sha2";
import type { AuthConfig } from "convex/server";

type CustomJwtProvider = Extract<AuthConfig["providers"][number], {
  type: "customJwt";
}>;

type IdentityJwk = {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
  kid: string;
  alg: "ES256";
  use: "sig";
  d?: string;
};

export interface SessionTokenCodecPayload {
  userId: string;
  sessionToken: string;
}

export interface SessionTokenCodec {
  encode: (payload: SessionTokenCodecPayload) => Promise<string>;
  decode: (token: string) => Promise<SessionTokenCodecPayload | null>;
}

export interface ConvexZenIdentityJwtOptions {
  issuer?: string;
  applicationID?: string;
  secret?: string;
  secretEnvVar?: string;
  algorithm?: "ES256";
  kid?: string;
  sessionTokenClaim?: string;
  tokenLifetime?: string;
}

export interface ConvexZenIdentityJwt {
  authProvider: CustomJwtProvider;
  sessionTokenCodec: SessionTokenCodec;
  publicJwks: { keys: [IdentityJwk] };
}

const DEFAULT_ENV_VAR = "CONVEX_ZEN_SECRET";
const DEFAULT_ALGORITHM = "ES256";
const DEFAULT_TOKEN_LIFETIME = "12h";
const DEFAULT_SESSION_TOKEN_CLAIM = "https://convex-zen.dev/sessionToken";
const DEFAULT_ISSUER = "https://convex-zen.local";
const DEFAULT_APPLICATION_ID = "convex-zen";
const MIN_SECRET_LENGTH = 32;
const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function readSecretInput(options: ConvexZenIdentityJwtOptions): string {
  const envVar = options.secretEnvVar ?? DEFAULT_ENV_VAR;
  const env = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env;
  const secret = options.secret ?? env?.[envVar];
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      `Missing identity JWT secret. Set ${envVar} to a random secret (recommended: openssl rand -base64 32).`
    );
  }
  const trimmedSecret = secret.trim();
  if (trimmedSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `Identity JWT secret is too short. Set ${envVar} to at least ${MIN_SECRET_LENGTH} characters.`
    );
  }
  return trimmedSecret;
}

function toBase64(bytes: Uint8Array): string {
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i] ?? 0;
    const b2 = bytes[i + 1] ?? 0;
    const b3 = bytes[i + 2] ?? 0;

    const n = (b1 << 16) | (b2 << 8) | b3;
    const c1 = (n >> 18) & 63;
    const c2 = (n >> 12) & 63;
    const c3 = (n >> 6) & 63;
    const c4 = n & 63;

    output += BASE64_ALPHABET[c1] ?? "";
    output += BASE64_ALPHABET[c2] ?? "";
    output += i + 1 < bytes.length ? BASE64_ALPHABET[c3] ?? "" : "=";
    output += i + 2 < bytes.length ? BASE64_ALPHABET[c4] ?? "" : "=";
  }
  return output;
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function toBase64Utf8(value: string): string {
  return toBase64(new TextEncoder().encode(value));
}

function toJwksDataUri(publicJwk: IdentityJwk): string {
  const jwks = { keys: [publicJwk] };
  return `data:application/json;base64,${toBase64Utf8(JSON.stringify(jwks))}`;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const value of bytes) {
    result = (result << 8n) + BigInt(value);
  }
  return result;
}

function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const output = new Uint8Array(length);
  let remaining = value;
  for (let index = length - 1; index >= 0; index -= 1) {
    output[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return output;
}

function derivePrivateScalar(secretHash: Uint8Array): Uint8Array {
  const curveOrder = p256.CURVE.n;
  const scalar = (bytesToBigInt(secretHash) % (curveOrder - 1n)) + 1n;
  return bigIntToBytes(scalar, 32);
}

function resolveKid(secretHash: Uint8Array, override?: string): string {
  if (override && override.length > 0) {
    return override;
  }
  return `cz-${toBase64Url(secretHash.slice(0, 8))}`;
}

function deriveIdentityJwks(
  secret: string,
  algorithm: "ES256",
  kidOverride?: string
): { privateJwk: IdentityJwk; publicJwk: IdentityJwk } {
  const secretHash = sha256(new TextEncoder().encode(secret));
  const privateScalar = derivePrivateScalar(secretHash);
  const publicKey = p256.getPublicKey(privateScalar, false);

  if (publicKey.length !== 65 || publicKey[0] !== 4) {
    throw new Error("Failed to derive a valid P-256 public key.");
  }

  const kid = resolveKid(secretHash, kidOverride);
  const x = toBase64Url(publicKey.slice(1, 33));
  const y = toBase64Url(publicKey.slice(33, 65));

  return {
    privateJwk: {
      kty: "EC",
      crv: "P-256",
      x,
      y,
      d: toBase64Url(privateScalar),
      alg: algorithm,
      use: "sig",
      kid,
    },
    publicJwk: {
      kty: "EC",
      crv: "P-256",
      x,
      y,
      alg: algorithm,
      use: "sig",
      kid,
    },
  };
}

export function createConvexZenIdentityJwt(
  options: ConvexZenIdentityJwtOptions = {}
): ConvexZenIdentityJwt {
  const algorithm = options.algorithm ?? DEFAULT_ALGORITHM;
  const tokenLifetime = options.tokenLifetime ?? DEFAULT_TOKEN_LIFETIME;
  const sessionTokenClaim =
    options.sessionTokenClaim ?? DEFAULT_SESSION_TOKEN_CLAIM;
  const issuer = options.issuer ?? DEFAULT_ISSUER;
  const applicationID = options.applicationID ?? DEFAULT_APPLICATION_ID;

  const secret = readSecretInput(options);
  const { privateJwk, publicJwk } = deriveIdentityJwks(
    secret,
    algorithm,
    options.kid
  );
  const kid = publicJwk.kid;
  const jwksDataUri = toJwksDataUri(publicJwk);

  let signingKeyPromise: Promise<Uint8Array | CryptoKey> | null = null;
  let verifyKeyPromise: Promise<Uint8Array | CryptoKey> | null = null;

  const getSigningKey = async () => {
    if (!signingKeyPromise) {
      const { importJWK } = await import("jose");
      signingKeyPromise = importJWK(
        {
          ...privateJwk,
          kid,
          alg: algorithm,
          use: "sig",
        },
        algorithm
      );
    }
    const keyPromise = signingKeyPromise;
    return keyPromise;
  };

  const getVerifyKey = async () => {
    if (!verifyKeyPromise) {
      const { importJWK } = await import("jose");
      verifyKeyPromise = importJWK(publicJwk, algorithm);
    }
    const keyPromise = verifyKeyPromise;
    return keyPromise;
  };

  const sessionTokenCodec: SessionTokenCodec = {
    encode: async ({ userId, sessionToken }) => {
      const [{ SignJWT }, key] = await Promise.all([
        import("jose"),
        getSigningKey(),
      ]);
      return new SignJWT({
        [sessionTokenClaim]: sessionToken,
      })
        .setProtectedHeader({ alg: algorithm, kid, typ: "JWT" })
        .setSubject(userId)
        .setIssuer(issuer)
        .setAudience(applicationID)
        .setIssuedAt()
        .setExpirationTime(tokenLifetime)
        .sign(key);
    },
    decode: async (token) => {
      try {
        const [{ jwtVerify }, key] = await Promise.all([
          import("jose"),
          getVerifyKey(),
        ]);
        const { payload } = await jwtVerify(token, key, {
          issuer,
          audience: applicationID,
          algorithms: [algorithm],
        });
        if (typeof payload.sub !== "string") {
          return null;
        }
        const sessionToken = payload[sessionTokenClaim];
        if (typeof sessionToken !== "string") {
          return null;
        }
        return {
          userId: payload.sub,
          sessionToken,
        };
      } catch {
        return null;
      }
    },
  };

  return {
    authProvider: {
      type: "customJwt",
      issuer,
      applicationID,
      algorithm,
      jwks: jwksDataUri,
    },
    sessionTokenCodec,
    publicJwks: {
      keys: [publicJwk],
    },
  };
}
