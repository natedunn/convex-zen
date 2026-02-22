# Third-Party Notices

This project is open source and may include ideas, ports, or adapted code from third-party projects.
When source code (or substantial portions) is copied or directly adapted, we document attribution and license details here.

## Policy

1. Do not copy external code line-for-line unless absolutely necessary.
2. Prefer reimplementation from behavior/spec understanding.
3. If code is copied or substantially adapted, add an entry to this file in the same PR.
4. Keep original license/copyright notices where required.
5. Do not copy third-party comments/docs/tests verbatim unless license obligations are handled.

## Notice Entry Template

Use this template for each third-party source:

```
### <Project Name>
- Source repository: <URL>
- Source file(s): <URL or path(s)>
- Commit/tag reviewed: <sha or tag>
- License: <license name>
- What was reused: <brief summary>
- Local file(s): <path(s) in this repo>
- Notes: <optional>
```

## Current Notices

### Better Auth

- Source repository: https://github.com/better-auth/better-auth
- Source file(s): Behavior and API design inspiration only
- Commit/tag reviewed: N/A
- License: MIT
- What was reused: No direct code copy intended; implementation is original unless explicitly noted in future entries
- Local file(s): packages/convex-auth/\*
- Notes: If any future PR ports code from Better Auth, add a detailed entry with exact source paths and commit.

### Convex Auth (Official)

- Source repository: https://github.com/get-convex/convex-auth
- Source file(s): Behavior and API design inspiration only
- Commit/tag reviewed: N/A
- License: Apache-2.0
- What was reused: No direct code copy intended; implementation is original unless explicitly noted in future entries
- Local file(s): packages/convex-auth/\*
- Notes: If any future PR ports code from Convex Auth, add a detailed entry with exact source paths and commit.
