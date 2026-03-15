## [1.8.2](https://github.com/natedunn/convex-zen/compare/convex-zen-v1.8.1...convex-zen-v1.8.2) (2026-03-15)


### Bug Fixes

* **auth:** restore convex wrapper typings ([a23b55f](https://github.com/natedunn/convex-zen/commit/a23b55f48d5983e513a05019ae6ab8742c323057))

## [1.8.1](https://github.com/natedunn/convex-zen/compare/convex-zen-v1.8.0...convex-zen-v1.8.1) (2026-03-15)


### Bug Fixes

* **types:** fix broken import in convex-direct-client-methods.ts; rename _ctx to _ in handler ([b04d985](https://github.com/natedunn/convex-zen/commit/b04d9855ba4600deba17f588507579f05eeaccf3))
* **types:** replace explicit any types with proper types in index.ts ([88e7230](https://github.com/natedunn/convex-zen/commit/88e723039abbb4fd030a77df41fd0f07c1c0ae2d))

# [1.8.0](https://github.com/natedunn/convex-zen/compare/convex-zen-v1.7.1...convex-zen-v1.8.0) (2026-03-14)


### Features

* **next:** simplify dev hostnames and auto-trust PORTLESS_URL ([65f3a06](https://github.com/natedunn/convex-zen/commit/65f3a0637c0c8b6384e9dc08fd032a2735e3fc89))

## [1.7.1](https://github.com/natedunn/convex-zen/compare/convex-zen-v1.7.0...convex-zen-v1.7.1) (2026-03-14)


### Bug Fixes

* **runtime:** replace btoa spread with loop-based base64 encoding for Convex runtime safety ([f626d49](https://github.com/natedunn/convex-zen/commit/f626d4975c0577ac77d2effbf661b4d0febc193c))
* **security:** address code review feedback ([99d88b6](https://github.com/natedunn/convex-zen/commit/99d88b66967ad96b591483fb0ccbfd9576119c07))
* **security:** address five vulnerabilities in auth library ([58d923b](https://github.com/natedunn/convex-zen/commit/58d923be6a4ce6e42f47af064e12d16b56c98875))

# [1.7.0](https://github.com/natedunn/convex-zen/compare/convex-zen-v1.6.0...convex-zen-v1.7.0) (2026-03-13)


### Bug Fixes

* **next:** load local env before sibling worktree envs ([5e9a14d](https://github.com/natedunn/convex-zen/commit/5e9a14d669926356537da8e263ac155d58b99f2c))
* **react:** update error message to mention both useZenSession and useSession hooks ([9b4d05f](https://github.com/natedunn/convex-zen/commit/9b4d05fe68da9ce1a35005e077b93c8a4506bf06))
* **tanstack-start-client:** remove dead executor vars from createTanStackRouteAuthClient ([50f5555](https://github.com/natedunn/convex-zen/commit/50f5555d3ae88c9f587cbbd7bf99e647ae163695))
* **tanstack:** load local env before sibling worktree envs ([0e1e0d0](https://github.com/natedunn/convex-zen/commit/0e1e0d037e2eef90e44b8bc08c088289257fa4d6))


### Features

* **auth:** add organization plugin with docs and playgrounds ([381d6cd](https://github.com/natedunn/convex-zen/commit/381d6cdef0ae42187567302d4e84d903ca1b94df))
* **expo:** add Expo client support ([ba75b33](https://github.com/natedunn/convex-zen/commit/ba75b338c3a9ba3a039e4761a07ee59c65c53cf3))

# [1.6.0](https://github.com/natedunn/convex-zen/compare/convex-zen-v1.5.0...convex-zen-v1.6.0) (2026-03-13)


### Bug Fixes

* **expo:** align native session flow with direct Convex auth ([08b0dfb](https://github.com/natedunn/convex-zen/commit/08b0dfb494df70220356451d3d3936f20d9161c7))
* **expo:** stop sending session tokens as Convex JWT auth ([09a9f74](https://github.com/natedunn/convex-zen/commit/09a9f748146f94090e4c5326dd2d0febff085fa0))
* **expo:** use real Convex function references in example app ([7b27270](https://github.com/natedunn/convex-zen/commit/7b27270b7c819120a8faa7bb79aad1864ec0c077))
* **oauth:** validate redirectTo and errorRedirectTo overrides in callback handler ([59357aa](https://github.com/natedunn/convex-zen/commit/59357aadaf29ada9ef877666c6c60cd1b6849633))


### Features

* **expo:** add first-class Expo client and example app ([0f6f2e2](https://github.com/natedunn/convex-zen/commit/0f6f2e22a43066d2b7567772fcac251e5486ecaf))

# [1.5.0](https://github.com/natedunn/convex-zen/compare/convex-zen-v1.4.0...convex-zen-v1.5.0) (2026-03-10)


### Features

* **auth:** add custom oauth provider api ([fe46dc4](https://github.com/natedunn/convex-zen/commit/fe46dc49da1734e3ecf65bf1d76624de9075fe88))

# [1.4.0](https://github.com/natedunn/convex-zen/compare/convex-zen-v1.3.0...convex-zen-v1.4.0) (2026-03-09)


### Bug Fixes

* **auth:** create credentials during oauth password reset ([0cf28a5](https://github.com/natedunn/convex-zen/commit/0cf28a57ddd53f8ca702894d7920fce0a0989e73))


### Features

* **auth:** add route-backed oauth support ([c1a9125](https://github.com/natedunn/convex-zen/commit/c1a9125060ffc792fd52569dfb2fd797bf79e8ce))

# [1.3.0](https://github.com/natedunn/convex-zen/compare/convex-zen-v1.2.0...convex-zen-v1.3.0) (2026-03-07)


### Features

* **examples:** align Next.js and TanStack apps for full parity ([67a5913](https://github.com/natedunn/convex-zen/commit/67a5913bd0e50ea7eb08f612a3c066c29a2e148a))
* **playground-ui:** add shared presentational package for example apps ([fa67ea3](https://github.com/natedunn/convex-zen/commit/fa67ea30d5b3dcd61ed230cde58c44d870b84f19))

# [1.2.0](https://github.com/natedunn/convex-zen/compare/convex-zen-v1.1.0...convex-zen-v1.2.0) (2026-03-06)


### Features

* **auth:** add next.js auth runtime and shared route clients ([bb8b3c0](https://github.com/natedunn/convex-zen/commit/bb8b3c016916a2e1ce5b0e3eabcb47e54a3aa748))

# [1.1.0](https://github.com/natedunn/convex-zen/compare/convex-zen-v1.0.2...convex-zen-v1.1.0) (2026-03-02)


### Bug Fixes

* **component:** make current user reads query-safe ([8cc7ef9](https://github.com/natedunn/convex-zen/commit/8cc7ef9836995f485cfafd1bb334a9cf2b42d647))


### Features

* **client:** add auth runtime and tanstack auth query adapters ([b7aad23](https://github.com/natedunn/convex-zen/commit/b7aad2327c4edc36759b0f679ae2226e7c7b168b))
* **generate:** support zen.config and unified auth metadata ([4acb377](https://github.com/natedunn/convex-zen/commit/4acb3773310fdf42204a8e8c55dc669aae0ba36e))

## [1.0.2](https://github.com/natedunn/convex-zen/compare/convex-zen-v1.0.1...convex-zen-v1.0.2) (2026-02-27)


### Bug Fixes

* **pkg:** add repository metadata for npm provenance ([48ce93f](https://github.com/natedunn/convex-zen/commit/48ce93ff56fd75eba54cbf56d56740e47829a992))

## [1.0.1](https://github.com/natedunn/convex-zen/compare/convex-zen-v1.0.0...convex-zen-v1.0.1) (2026-02-27)


### Bug Fixes

* **ci:** upgrade npm for trusted publishing ([28aba0a](https://github.com/natedunn/convex-zen/commit/28aba0a4d3872ce0f586611082aa49d66f438cd9))

# 1.0.0 (2026-02-27)


### Bug Fixes

* **ci:** add manual release workflow trigger ([a5c06ed](https://github.com/natedunn/convex-zen/commit/a5c06ed7d2e047dac785f018bba10cb5dde1b042))
* **ci:** resolve release workflow pnpm and auth setup ([e9c1f02](https://github.com/natedunn/convex-zen/commit/e9c1f02c23bd88098a3334ad7e2bfe29a5564ff0))
* **release:** add npm token fallback and disable failing issue labels ([3fb7e32](https://github.com/natedunn/convex-zen/commit/3fb7e32957b8093a0ce3847896df8959395cb49b))
* **release:** automate npm and GitHub publishing ([f1c750d](https://github.com/natedunn/convex-zen/commit/f1c750d294dcddc9e2cd592578f1687aa987166d))
* **tanstack:** remove accidental auth test code ([24a0f0e](https://github.com/natedunn/convex-zen/commit/24a0f0ed94d16ffea94f01d3878286ef4337f933))
* **web:** remove deprecated baseUrl from convex tsconfig ([4ef9044](https://github.com/natedunn/convex-zen/commit/4ef90447ba8a22c8a2bb90cf0832d08fc8763aad))


### Features

* add convex-zen auth package and demo app ([b4765fd](https://github.com/natedunn/convex-zen/commit/b4765fd01cc1da96470f5d4378d668310e69aad3))
* **auth:** add auto plugin routing and generated metadata ([ce52945](https://github.com/natedunn/convex-zen/commit/ce529452daa6d9d249e73d3a9444925927219c61))
* **auth:** add tanstack helpers and auth function generator ([70cc41e](https://github.com/natedunn/convex-zen/commit/70cc41e84ccb0e132b268f21a47dc5cac23b509c))
* **convex-zen:** add session primitives and framework adapters ([4df6c19](https://github.com/natedunn/convex-zen/commit/4df6c19e2a93de6e3147daddbc1341088abc8aec))
