# @chief-clancy/core

## 2.0.0

### Major Changes

- [#344](https://github.com/Pushedskydiver/chief-clancy/pull/344) [`37e644f`](https://github.com/Pushedskydiver/chief-clancy/commit/37e644f5e3c222350f159d58540dd78d1835e8fa) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - **BREAKING** — `PingResult` in `@chief-clancy/core/types/board.js` is now a proper discriminated union:

  ```ts
  // Before
  type PingResult = { ok: boolean; error?: string };

  // After
  type PingResult =
    | { ok: true }
    | { ok: false; error: { kind: 'unknown'; message: string } };
  ```

  Per CONVENTIONS.md §Error Handling — the `error` channel is a tagged discriminated union (house shape: `{ ok: false, error: { kind: '<tag>', ...context } }`), ergonomically close to a bare string but on a typed chassis for future widening (`kind: 'auth'`, `kind: 'network'`, etc.) without string parsing.

  Consumers must read `result.error.message` where they previously read `result.error`. `pingEndpoint` and all 6 board adapters (github, jira, linear, notion, azdo, shortcut) updated. Dev's `preflight-phase.ts` cascade updated. ~20 test assertion sites migrated to `toMatchObject({ error: { kind: 'unknown', message: expect.stringContaining(...) } })`.

## 1.0.3

### Patch Changes

- [#342](https://github.com/Pushedskydiver/chief-clancy/pull/342) [`e7fc21e`](https://github.com/Pushedskydiver/chief-clancy/commit/e7fc21e86d38066091ed04e2a4825b5cbefca2ce) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add missing TSDoc to public-API symbols that were thin on semantics per CONVENTIONS.md §Code Style. `Cached.store` and `CachedMap.store` in `core/src/shared/cache.ts` — document overwrite semantics. `Board.validateInputs` in `core/src/types/board.ts` — clarify that validation is optional and document the error-message-or-undefined return shape. `runReadinessGate` in `dev/src/execute/readiness/readiness-gate.ts` — document green-immediate, red-immediate, yellow-retry behaviour and the subagent-override. `InstallPaths` + `RunInstallOptions` in `terminal/src/installer/install/install.ts` — cross-link to `resolveInstallPaths` for the canonical path shape and document `nonInteractive`/`now` semantics.

## 1.0.2

### Patch Changes

- [#340](https://github.com/Pushedskydiver/chief-clancy/pull/340) [`b0b3d81`](https://github.com/Pushedskydiver/chief-clancy/commit/b0b3d81595590e137354decdcb883085233960ee) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Remove TSDoc blocks that restate signatures, per CONVENTIONS.md §Code Style "Delete TSDoc that restates the signature." Surgical preservation where the prose adds genuine semantics (e.g. "Creates the `.clancy` directory if needed", "Bold+blue for contrast on dark backgrounds"). No behaviour change; internal type inference unaffected. Covers `core/src/schemas/env.ts`, `core/src/types/board.ts`, `core/src/types/remote.ts`, `dev/src/lifecycle/lock.ts`, `dev/src/lifecycle/rework/rework.ts`, `dev/src/lifecycle/cost/cost.ts`, `dev/src/lifecycle/quality/quality.ts`, `terminal/src/shared/ansi.ts`, `terminal/src/runner/autopilot.ts`.

## 1.0.1

### Patch Changes

- [#331](https://github.com/Pushedskydiver/chief-clancy/pull/331) [`ea68f87`](https://github.com/Pushedskydiver/chief-clancy/commit/ea68f876b7026bbff582c039b9feea119912715f) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Rename `compute*` and `attempt*` functions per verb vocabulary convention.

  **Breaking (dev):** `computeTicketBranch` → `ticketBranch`, `computeTargetBranch` → `targetBranch`, `attemptPrCreation` → `createPr`. Internal: `computeDeliveryOutcome` → `deliveryOutcome`, `computeDrift` → `drift`.

  **Internal (core):** `attemptFetch` → `fetchLoop` (private, not exported).

## 1.0.0

### Major Changes

- [#312](https://github.com/Pushedskydiver/chief-clancy/pull/312) [`08b9906`](https://github.com/Pushedskydiver/chief-clancy/commit/08b99061f928ee29b0601bbe841b62e52182d247) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Barrier-Core: flatten single-impl wrappers and delete fan-out barrels

  All internal `index.ts` barrels under `core/src/{types,schemas,shared,board}/` have been deleted (38 total). Single-impl wrapper folders have been flattened (33 total — `X/X.ts` lifted to parent as `X.ts`). Consumers that previously imported from a barrel path (`@chief-clancy/core/types/index.js`, `@chief-clancy/core/schemas/index.js`, `@chief-clancy/core/shared/<p>/index.js`, `@chief-clancy/core/board/<provider>/index.js`, etc.) must now import from the declaration file directly.

  **Migration guide:**
  - `@chief-clancy/core/types/index.js` → `@chief-clancy/core/types/board.js` | `/types/remote.js` | `/types/progress.js` (per symbol).
  - `@chief-clancy/core/schemas/index.js` → `@chief-clancy/core/schemas/env.js` | `/schemas/<provider>.js` | `/schemas/azdo/azdo.js` (per symbol).
  - `@chief-clancy/core/shared/<wrapper>/index.js` (env-parser, cache, git-ops, git-token, label-helpers, remote) → `@chief-clancy/core/shared/<wrapper>.js`.
  - `@chief-clancy/core/shared/http/index.js` → `@chief-clancy/core/shared/http/fetch-and-parse.js` | `/ping-endpoint.js` | `/retry-fetch.js` (per symbol).
  - `@chief-clancy/core/board/index.js` → `@chief-clancy/core/board/detect-board.js`.
  - `@chief-clancy/core/board/<provider>/index.js` → `@chief-clancy/core/board/<provider>/<provider>-board.js` + `.../relations.js` (per symbol). Labels were never exposed via the provider barrel — consumers needing label helpers import them directly from `.../labels.js` (covered by the bullet below).
  - `@chief-clancy/core/board/factory/index.js` → `@chief-clancy/core/board/factory.js`.
  - `@chief-clancy/core/board/<provider>/{api,labels,relations}/index.js` → `.../<kind>.js` (flat) for github/jira/linear/shortcut. For azdo/notion `api/`, the folder remains multi-content: import from `api.js` or `helpers.js` directly.

  The `package.json` `exports` map is unchanged — the wildcard patterns (`./types/*.js`, `./schemas/*.js`, `./shared/*.js`, `./board/*.js`) still cover every resolvable path. Only the internal structure within each subtree changed.

  Consumers using the package root (`@chief-clancy/core`) are unaffected — `src/index.ts` still exports the same public symbols; it now sources them from declaration files directly.

## 0.2.0

### Minor Changes

- [#302](https://github.com/Pushedskydiver/chief-clancy/pull/302) [`c2ee440`](https://github.com/Pushedskydiver/chief-clancy/commit/c2ee440d2486333c7ba0073fc110122c6c29f9d6) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - **Breaking:** tighten `package.json` `exports` to four namespaced subdirectory wildcards.

  The top-level `./*.js` wildcard export has been replaced with four explicit subpaths:
  - `./types/*.js`
  - `./schemas/*.js`
  - `./shared/*.js`
  - `./board/*.js`

  Consumers may import from the package root (`@chief-clancy/core`) or any of the four subpaths above. Top-level deep imports like `@chief-clancy/core/foo.js` are no longer resolvable.

  This is a breaking change under pre-1.0 semver — bumping `0.1.2 → 0.2.0`. The published 0.1.x range accidentally exposed every file under `dist/` via the top-level `./*.js` wildcard; 0.2.0 restricts the surface to the four intentional namespaces. In-repo consumers (`@chief-clancy/terminal`, `@chief-clancy/dev`) were already using the four subpaths exclusively; the narrowing makes the public API surface explicit for published consumers.

  See `packages/core/README.md` for the full deep-import policy.

## 0.1.2

### Patch Changes

- [#286](https://github.com/Pushedskydiver/chief-clancy/pull/286) [`404a224`](https://github.com/Pushedskydiver/chief-clancy/commit/404a2240e157ae0d61e627dedcd656551eda0ed6) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add `--from` support to the implement pipeline for local plan execution.

  **dev (minor):** Plan file parser (`parsePlanFile`, `checkApprovalStatus`, `toSyntheticTicket`), local-mode infrastructure (no-op board, synthetic config, local preflight), pipeline wiring for `--from`, directory listing with natural sort (`listPlanFiles`), and public API exports for all plan-file utilities.

  **terminal (patch):** Batch runner (`runImplementBatch`) for `--from {directory} --afk`, implement entry point with directory detection and `--afk` dispatch, workflow and command docs for batch mode, e2e tests for local plan pipeline and lifecycle contracts.

  **plan (patch):** README updated — replaced deferred `implement-from` text with shipped `--from` usage docs pointing at `chief-clancy` and `/clancy:implement`.

  **chief-clancy, core, brief, scan (patch):** README consistency pass — standardised monorepo link ordering (dependency-first), section naming, early-stage warning, and `--from` mentions where applicable.

## 0.1.1

### Patch Changes

- [#260](https://github.com/Pushedskydiver/chief-clancy/pull/260) [`fb22c36`](https://github.com/Pushedskydiver/chief-clancy/commit/fb22c36bc4d3ace684ea8f8dfee00364e7c9c137) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Initial public release of @chief-clancy/dev — autonomous ticket executor with readiness gate, AFK loop, and structured artifact reporting. All package READMEs standardised with consistent monorepo section, credits, and license. Terminal bumped to pick up dev 0.1.0 dependency.
