# Auth Migration Plan (Identity-Only)

Goal: make `convex-zen` a real auth library replacement where app code and Convex functions share one auth model: Convex identity (`ctx.auth`) backed by JWTs.

## 1. Product direction
- Single mode: identity-only.
- No token-arg authorization path in admin APIs or gateway functions.
- TanStack Start adapter/server handlers always call Convex with authenticated headers.

## 2. Library contract
- `auth.admin.*` resolves actor identity from `ctx.auth` (or `resolveUserId`) and passes `actorUserId` internally.
- Component gateway admin functions require `actorUserId`.
- Generated host wrappers expose admin args without `token` fields.

## 3. TanStack adapter contract
- `/api/auth/admin/*` routes call `fetchAuthQuery/fetchAuthMutation` only.
- No JWT-shape heuristics and no token payload fallback.
- Browser code uses `authClient.admin.*` with no manual token handling.

## 4. Required infrastructure
- Host app must provide Convex-valid JWT identity setup (issuer/JWKS + `convex/auth.config.ts`).
- Session cookie/auth API should carry identity tokens that Convex can validate for `ctx.auth`.
- Key material should come from one env var (`CONVEX_ZEN_SECRET`) via library helpers, not committed key files.

## 5. Test expectations
- Admin calls succeed for admin identity.
- Non-admin identity returns `Forbidden`.
- Missing identity args fail validation/authorization.
- Optional admin endpoints return `404` when action refs are not configured.

## 6. Docs posture
- Identity mode is the default and only documented path.
- Remove token fallback guidance and migration compatibility language.
