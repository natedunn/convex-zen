# convex-zen

A production-grade authentication component built natively for [Convex](https://convex.dev). No framework baggage, no adapter layers — runs directly on Convex with security best practices baked in.

---

## Why this exists

[Better Auth](https://www.better-auth.com) is a capable auth library, but it brings significant baggage when used with Convex:

- It was designed for traditional server environments — it expects a database adapter layer, a Node.js HTTP server, and its own session/user management that duplicates what Convex already does well
- The `better-auth/convex` adapter is a shim on top of a shim — it translates Better Auth's data model into Convex queries, which is both fragile and wasteful
- It carries abstractions designed for many databases and frameworks, most of which don't apply in a Convex app
- Configuration is complex and its security decisions are buried in adapters and middleware

`convex-zen` is built the other way around: **start with Convex, add auth on top**. It treats Convex's reactivity, components, and function types as first-class features rather than things to work around.

The goal is to cover ~90% of what Better Auth offers, but designed specifically for how Convex apps are actually built.

---

## Design philosophy

### Good bones over feature completeness

The architecture is meant to scale upward. It is better to have a small, clean, well-tested core that is easy to extend than to ship everything at once with rough edges. Each phase should be something you could ship to production today.

### Core is small — plugins handle the rest

**Core** (always present, no configuration required):
- Email/password auth with verification
- OAuth (Google, GitHub — more providers added over time)
- Session management

Everything else — admin tools, future MFA, magic links, phone auth, webhooks — is a **plugin**. Plugins are opt-in at construction time and statically compiled into the component. There is no runtime plugin loading; if you don't configure a plugin it contributes nothing.

The admin plugin is the first plugin, and exists as much to validate the plugin system as to provide real functionality.

### The host app provides what the component cannot

Convex components cannot access `process.env`, cannot send emails, and cannot know your UI's redirect URLs. Rather than pretending otherwise, this library makes those boundaries explicit:

- **Email sending** is always the host app's responsibility. Pass an `emailProvider` with `sendVerificationEmail` and `sendPasswordResetEmail`. Use Resend, Postmark, Nodemailer — whatever you already use.
- **OAuth client secrets** come from the host app's environment, passed into provider config objects.
- **HTTP routes** for OAuth callbacks are mounted on the host app's `httpRouter`, not hidden inside the component.

### Security follows the Copenhagen Book

Cryptographic and session security decisions follow [The Copenhagen Book](https://thecopenhagenbook.com/) — a practical, opinionated reference for web auth security:

- Argon2id for passwords (memory-hard, GPU/ASIC resistant)
- 256-bit random tokens for sessions, OAuth state, and PKCE verifiers
- Session tokens stored as SHA-256 hashes only — the raw token is returned once and never persisted
- Verification codes are 8-char alphanumeric, stored as SHA-256, single-use, time-limited
- OAuth uses PKCE (code challenge/verifier) in addition to state validation
- Rate limiting with hard lockout on brute-force attempts

### Lean and documented

No magic. Every public method has a JSDoc comment. Every security decision has a reason. The codebase should be readable by someone who didn't write it. Prefer explicit over clever.

---

## What this is

`convex-zen` is a Convex component that provides:

- **Email/password auth** — sign up, email verification, sign in, password reset
- **OAuth** — Google and GitHub with PKCE
- **Session management** — sliding window sessions with absolute timeout
- **Admin plugin** — list users, ban/unban, assign roles, delete
- **Rate limiting** — brute-force protection on auth endpoints
- **Strong cryptography** — Argon2id passwords, SHA-256 session token storage, 256-bit random tokens

The repo also contains `apps/web`, a TanStack Start + React demo app that exercises all auth flows.

---

## Monorepo structure

```
convex-zen/
├── package.json                # pnpm workspace root
├── pnpm-workspace.yaml         # packages/* and apps/*
├── PROJECT.md                  # this file
├── packages/
│   └── convex-auth/            # convex-zen — the component
└── apps/
    └── web/                    # demo / test application
```

**Package manager:** pnpm 10. Use `pnpm install` at the root.

---

## Licensing and provenance

- Repository license: Apache License 2.0 (`LICENSE`)
- Repository notices: `NOTICE`
- Third-party provenance + attribution log: `THIRD_PARTY_NOTICES.md`

### Contribution policy

1. Prefer original implementation from behavior/spec understanding over line-by-line copying.
2. If third-party code is copied or substantially adapted, document source repo/path/commit and license in `THIRD_PARTY_NOTICES.md` in the same PR.
3. Preserve required upstream notices and license text when reuse requires it.

---

## packages/convex-auth

### Overview

A Convex component (`defineComponent("convexAuth")`) that the host app installs via `convex.config.ts`. All auth logic is isolated inside the component. The host app interacts through a client wrapper class (`ConvexAuth`) which calls the component's public gateway actions.

### File structure

```
packages/convex-auth/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── types.ts                       # Shared TypeScript interfaces
    ├── client/                        # Host-app-facing API
    │   ├── index.ts                   # ConvexAuth class
    │   ├── providers.ts               # googleProvider(), githubProvider()
    │   └── plugins/
    │       └── admin.ts               # adminPlugin() factory + AdminPlugin class
    └── component/                     # Convex component (server-side)
        ├── convex.config.ts           # defineComponent("convexAuth")
        ├── schema.ts                  # All 7 database tables
        ├── gateway.ts                 # Public action entrypoints (callable from host)
        ├── core/
        │   ├── users.ts               # Internal user CRUD
        │   ├── sessions.ts            # Session create/validate/extend/invalidate
        │   └── verifications.ts       # Email verification + password reset codes
        ├── providers/
        │   ├── emailPassword.ts       # Email/password sign up, sign in, reset
        │   └── oauth.ts               # OAuth authorization URL + callback handler
        ├── plugins/
        │   └── admin.ts               # listUsers, banUser, unbanUser, setRole, deleteUser
        └── lib/
            ├── crypto.ts              # Token generation, SHA-256, PKCE helpers
            └── rateLimit.ts           # Sliding window rate limiting
```

### Package exports (development — source, no build step)

```
convex-zen              → src/client/index.ts
convex-zen/plugins/admin → src/client/plugins/admin.ts
convex-zen/convex.config → src/component/convex.config.ts
```

### Key dependency

- `hash-wasm` — pure WASM Argon2id (base64-inlined, bundles cleanly with esbuild). `@node-rs/argon2` does **not** work in Convex because it uses native `.node` binaries.

---

## Database schema (7 tables)

All tables live inside the component's own namespace.

### `users`
Core identity. One row per person.
```
email, emailVerified, name?, image?, createdAt, updatedAt
role?, banned?, banReason?, banExpires?   ← admin plugin fields
```
Index: `by_email`

### `accounts`
One row per auth method per user (e.g., a user can have a Google account AND a password account).
```
userId, providerId ("credential"|"google"|"github"), accountId
passwordHash?   ← Argon2id PHC string, credential only
accessToken?, refreshToken?, accessTokenExpiresAt?
createdAt, updatedAt
```
Indexes: `by_userId`, `by_provider_accountId`

### `sessions`
```
userId, tokenHash (SHA-256 of raw token), expiresAt, absoluteExpiresAt
lastActiveAt, ipAddress?, userAgent?, createdAt
```
Indexes: `by_tokenHash`, `by_userId`, `by_expiresAt`

Session duration: **1 hour sliding window**, extended every 30 min. **12 hour absolute max**.

### `verifications`
Email verification codes and password reset codes.
```
identifier (email), type ("email-verification"|"password-reset")
codeHash (SHA-256 of 8-char code), expiresAt, attempts, createdAt
```
Index: `by_identifier_type`

### `oauthStates`
PKCE + state for OAuth flows. Short-lived (10-min TTL).
```
stateHash (SHA-256 of state), codeVerifier, provider, redirectUrl?, expiresAt, createdAt
```
Index: `by_stateHash`

### `rateLimits`
Sliding window counters per key.
```
key (e.g. "signin:ip:1.2.3.4"), count, windowStart, lockedUntil?
```
Index: `by_key`. Window: 10 min. Max: 10 failures. Lockout: 10 min.

### `config`
Plugin/feature configuration stored as JSON.
```
key, value (JSON string)
```
Index: `by_key`

---

## The gateway pattern (critical to understand)

Convex component functions are `internalAction`/`internalMutation`/`internalQuery` — they are **not callable from the host app**. Only public `action`/`mutation`/`query` are reachable via `ctx.runAction(components.convexAuth.xxx, ...)`.

`src/component/gateway.ts` is a thin public `action` layer that wraps every internal function. The host app only ever calls gateway functions. The `ConvexAuth` client wrapper resolves gateway paths via the `fn("gateway:functionName")` helper.

```
Host app ctx.runAction()
    → components.convexAuth.gateway.signUp
        → ctx.runAction(internal.providers.emailPassword.signUp, args)
```

All gateway functions are `action` type because actions can call queries, mutations, and other actions — making them the most flexible gateway type.

---

## Public client API

### Setup in host app

```ts
// convex/auth.ts
import { ConvexAuth } from "convex-zen";
import { googleProvider, githubProvider } from "convex-zen";
import { adminPlugin } from "convex-zen/plugins/admin";
import { components } from "./_generated/api";

export const auth = new ConvexAuth(components.convexAuth, {
  providers: [
    googleProvider({ clientId: "...", clientSecret: "..." }),
    githubProvider({ clientId: "...", clientSecret: "..." }),
  ],
  emailProvider: {
    sendVerificationEmail: async (to, code) => { /* Resend, etc. */ },
    sendPasswordResetEmail: async (to, code) => { /* ... */ },
  },
  plugins: [adminPlugin({ defaultRole: "user", adminRole: "admin" })],
  requireEmailVerified: true,  // default
});

// convex/http.ts — register OAuth callback routes
const http = httpRouter();
auth.registerRoutes(http);   // mounts GET /auth/callback/google, /auth/callback/github
export default http;
```

### ConvexAuth methods

| Method | Ctx type | Description |
|--------|----------|-------------|
| `signUp(ctx, { email, password, name? })` | action | Hash password, create user, return verification code to send |
| `signIn(ctx, { email, password })` | action | Verify password, create session, return `{ sessionToken, userId }` |
| `verifyEmail(ctx, { email, code })` | action | Validate code, mark email verified |
| `requestPasswordReset(ctx, { email })` | action | Generate reset code, return it to send via emailProvider |
| `resetPassword(ctx, { email, code, newPassword })` | action | Validate code, update password hash |
| `getOAuthUrl(ctx, providerId, redirectUrl?)` | action | Generate state+PKCE, return authorization URL |
| `handleCallback(ctx, { code, state, providerId, ... })` | action | Exchange code, upsert user, return `{ sessionToken, userId }` |
| `validateSession(ctx, token)` | action | Returns `{ userId, sessionId }` or `null` |
| `signOut(ctx, token)` | action | Invalidate one session |
| `signOutAll(ctx, userId)` | action | Invalidate all sessions for a user |
| `registerRoutes(http, options?)` | — | Mount OAuth callback HTTP routes |
| `plugins.admin` | — | Returns `AdminPlugin` instance (or null if not configured) |

### AdminPlugin methods (all use `runAction` ctx)

```ts
const admin = auth.plugins.admin;
await admin.listUsers(ctx, { limit?: number, cursor?: string })
  // → { users, cursor, isDone }
await admin.banUser(ctx, { userId, reason?, expiresAt? })
await admin.unbanUser(ctx, { userId })
await admin.setRole(ctx, { userId, role })
await admin.deleteUser(ctx, { userId })
```

---

## Auth flows

### Email/password sign-up
1. Rate check by IP
2. Ensure email not taken
3. Hash password (Argon2id, 19MB memory, 2 iterations)
4. `ctx.db.insert("users", ...)` + `ctx.db.insert("accounts", ...)`
5. Generate 8-char alphanumeric code; store `SHA-256(code)` in `verifications`
6. Return `{ verificationCode }` — host app sends it via email
7. Client calls `verifyEmail(email, code)` → marks `emailVerified: true`

### Email/password sign-in
1. Rate check (IP + email identifier)
2. Look up user → look up account → `argon2Verify(password, hash)`
3. Check `emailVerified` (if `requireEmailVerified: true`)
4. Check banned status (if admin plugin active)
5. Generate 32-byte random token; store `SHA-256(token)` in sessions
6. Return raw token to client (never stored in DB)

### OAuth
1. `getOAuthUrl`: generate `state` (256-bit random), PKCE verifier+challenge; store in `oauthStates`; return provider auth URL
2. Provider redirects to `/auth/callback/:provider?code=...&state=...`
3. `handleCallback`: validate state, exchange code for tokens, fetch user info, upsert user+account, create session

### Session validation (every request)
1. `SHA-256(token)` → look up in `sessions` by `tokenHash`
2. Check `expiresAt` and `absoluteExpiresAt`
3. If `lastActiveAt` > 30min ago, extend session (mutation)
4. Check user banned (if admin plugin active)
5. Return `{ userId, sessionId }` or `null`

---

## Security checklist

| Property | Implementation |
|----------|---------------|
| Password hashing | Argon2id, 19MB memory, 2 iter, parallelism 1, PHC encoded |
| Token entropy | 32 bytes from `crypto.getRandomValues` = 256 bits |
| Session token storage | SHA-256 hash only — raw token returned once, never persisted |
| Verification codes | 8-char alphanumeric (A-Z, 2-9), SHA-256 stored, single-use |
| OAuth state | 256-bit random, SHA-256 stored, 10-min TTL, consumed on use |
| PKCE | SHA-256 code challenge, code verifier stored server-side |
| Rate limiting | 10 failures / 10 min → 10-min lockout (per IP + per identifier) |
| Session duration | 1h sliding, extend every 30min, 12h absolute max |
| Email validation | Simple format check only — no ReDoS-prone regex |
| Admin banned check | Checked at `validateSession` time, not just sign-in |

### Crypto helpers (`lib/crypto.ts`)

```ts
generateToken()           // 32-byte random → hex string
hashToken(token)          // SHA-256 → hex string (Web Crypto)
generateCode()            // 8-char from "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
generateCodeVerifier()    // 32-byte random → base64url (PKCE)
generateCodeChallenge(v)  // SHA-256(verifier) → base64url
generateState()           // 32-byte random → hex string
```

---

## apps/web (demo application)

TanStack Start (SSR) + TanStack Router (file-based) + Convex React client. Demonstrates all auth flows.

### Routes

| Route | Purpose |
|-------|---------|
| `/` | Home — shows session status |
| `/signup` | Email/password sign up form |
| `/verify` | Email verification code entry |
| `/signin` | Sign in form, stores token in `localStorage` |
| `/reset` | Password reset (two phases: request → enter code) |
| `/dashboard` | Protected — shows userId/sessionId, sign out button |
| `/admin` | Admin panel — user list, ban, role assignment |

### Convex setup

```
apps/web/convex/
├── auth.ts           # ConvexAuth instance (email codes → console.log in dev)
├── convex.config.ts  # app.use(convexAuth)
├── schema.ts         # Host app schema (empty — all data in component)
├── http.ts           # auth.registerRoutes(http)
└── functions.ts      # Public actions for frontend to call
```

### Dev configuration

- Emails print to Convex dev server console (no real email service needed)
- `requireEmailVerified: false` in dev for convenience
- Session token stored in `localStorage` (demo only — use HttpOnly cookies in production)
- Admin plugin active with `defaultRole: "user"`, `adminRole: "admin"`

### Environment variables

```
# apps/web/.env.local
VITE_CONVEX_URL=https://your-project.convex.cloud
```

---

## Development

```bash
# Install dependencies
pnpm install

# Run Convex backend (from apps/web)
cd apps/web
pnpm exec convex dev

# Run frontend dev server (separate terminal)
pnpm dev

# Run tests (from packages/convex-auth)
cd packages/convex-auth
pnpm test

# Run tests with coverage
pnpm test:coverage
```

---

## Known Convex component constraints

These are platform constraints, not bugs:

1. **`paginate()` not available in components** — `listUsers` uses `_creationTime` as a cursor with `.filter() + .take()` instead.
2. **No `process.env` in components** — config (like OAuth client secrets) must be passed as function args from the host app.
3. **No `ctx.auth` in components** — user identity must be passed explicitly.
4. **`internalAction`/`internalMutation`/`internalQuery` are not callable from the host** — only public functions in `gateway.ts` are reachable via `components.convexAuth.*`.
5. **`Id<"table">` types are opaque outside the component** — the host app treats component IDs as plain strings.
6. **`@node-rs/argon2` does not bundle** — use `hash-wasm` instead (WASM base64-inlined in bundle).

---

## Testing

Framework: Vitest + `convex-test`

```
packages/convex-auth/tests/
├── sessions.test.ts       # create, validate, extend, expiry, invalidate
├── emailPassword.test.ts  # signUp, signIn, verify, reset, rate limiting
├── oauth.test.ts          # state/PKCE generation, callback (valid/invalid)
└── admin.test.ts          # listUsers, ban/unban, setRole
```

Tests use `convexTest(schema, modules)` and call `internal.*` functions directly — no gateway layer needed in tests.

---

## Roadmap / not yet implemented

- Magic link (passwordless email) auth
- Phone/SMS auth
- Multi-factor authentication (TOTP)
- Session device tracking
- Webhook events on auth actions
- Built-in email templates (currently caller-supplied)
- React hooks package (`useSession`, `useSignIn`, etc.)
- React Native support
