# 08 - Example Parity Checklist (Next.js + TanStack Start)

This file defines what both demo apps must test and how they should look so they stay in sync.

## Goal

Keep `apps/next` and `apps/tanstack` aligned on:

1. Core auth behaviors we validate during development.
2. UI structure and visual identity.
3. Clear framework labeling so screenshots/videos are never ambiguous.

## Parity policy

1. `P0` items are required in both demos.
2. `P1` items are recommended in both demos; acceptable to phase in.
3. `P0-plugin` items are required only when the referenced plugin is enabled in that demo.
4. Framework-specific extras are allowed, but must be documented as extras and not replace `P0`.

## Test matrix

Use this as the source-of-truth checklist when adding features or reviewing drift.

| Priority | ID | Scope | Capability to test in both demos | Next.js (2026-03-07) | TanStack (2026-03-07) | Minimum acceptance check |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | A1 | Core | Email/password sign up | Yes | Yes | Can create a new account from UI and receive success/next-step state. |
| P0 | A2 | Core | Email verification | Yes | Yes | Can submit verification code and transition to verified state. |
| P0 | A3 | Core | Email/password sign in | Yes | Yes | Can sign in from UI and get an authenticated session. |
| P0 | A4 | Core | Sign out | Yes | Yes | Can sign out and return to unauthenticated state. |
| P0 | A5 | Core | Session fetch/refresh | Yes | Yes | UI can refresh and display current session status. |
| P0 | A6 | Core | Protected route guard | Yes | Yes | Protected page blocks unauthenticated users and allows authenticated users. |
| P0 | A7 | Core | Forgot/reset password | Yes | Yes | Can request reset and complete reset with code. |
| P0 | A8 | Core | Auth error states | Yes | Yes | Invalid credentials/code errors are shown clearly in UI. |
| P0 | A9 | Core | Loading states | Yes | Yes | Async actions show loading state and prevent duplicate submits. |
| P0-plugin | A10 | System Admin plugin | System Admin list users | Yes | Yes | System Admin page loads user list for authorized user. |
| P0-plugin | A11 | System Admin plugin | System Admin role update | Yes | Yes | System Admin can change user role and see updated state. |
| P0-plugin | A12 | System Admin plugin | System Admin ban/unban | Yes | Yes | System Admin can ban and unban user and see updated state. |
| P1 | B1 | Core | Token diagnostics | Yes | Yes | Developer-facing token/session debug panel exists for quick troubleshooting. |
| P1 | B2 | Core | Redirect intent handling | No | Partial | Sign-in flow preserves intended redirect target. |
| P1 | B3 | Core | Host/local env parity | Unknown | Unknown | Works on `localhost`, `127.0.0.1`, and local custom host setup. |

Notes:

1. If a plugin is intentionally disabled for a demo, mark plugin rows `N/A` for that demo.
2. Admin parity only applies when the admin plugin is enabled.

## Shared UI contract

Both demos share a common `@convex-zen/playground-ui` workspace package that provides:

1. **Shared CSS** (`playground.css`) with unified class names and design tokens.
2. **Shared components**: `StatusTag`, `SessionCard`, `UserRow`, `TokenDiagnostics`.

Both demos can keep framework-specific implementation details, but they should share the same visual baseline:

1. Common heading text:
   - `convex-zen auth playground`
2. Framework badge in hero (required, obvious):
   - Next app: `NEXT.JS EXAMPLE`
   - TanStack app: `TANSTACK START EXAMPLE`
3. Shared brand color tokens:
   - `--cz-primary: #23395d`
   - `--cz-accent: #4f46e5`
   - `--cz-text: #1e293b`
   - `--cz-muted: #64748b`
   - `--cz-success: #16a34a`
   - `--cz-danger: #dc2626`
   - `--cz-surface: #f8fafc`
4. Shared component intent:
   - Primary action button (`.btn-primary`)
   - Secondary action button (`.btn-secondary`)
   - Danger action button (`.btn-danger`)
   - Card container (`.card`)
   - Status tags (`.tag-success` / `.tag-danger` / `.tag-neutral`)
5. Shared page-level layout expectations:
   - Consistent top nav/hero placement
   - Consistent spacing scale
   - Consistent form label/input/button rhythm

## Allowed differences

These are acceptable as long as `P0` parity remains intact:

1. Router idioms (App Router vs TanStack file routes).
2. Server integration style (route handlers/actions vs server functions).
3. Small visual flavor differences after shared tokens and badge requirements are met.

## Working routine

When touching either demo:

1. Update both demos or explicitly log why not in the same PR.
2. Re-check all `P0` matrix items manually.
3. Keep this checklist updated when scope changes.
