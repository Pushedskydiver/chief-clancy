# @chief-clancy/dev

## 0.5.1

### Patch Changes

- [#334](https://github.com/Pushedskydiver/chief-clancy/pull/334) [`32145ac`](https://github.com/Pushedskydiver/chief-clancy/commit/32145ac81b16bf30d1fea0cf6d2c84650f2830d1) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Conventions compliance sweep — expression-level fixes (Rules 2, 3, 8).
  Invert 3 empty-fallback ternaries, inline 3 tautological `result`
  variables, and remove 8 section dividers from touched files.

## 0.5.0

### Minor Changes

- [#331](https://github.com/Pushedskydiver/chief-clancy/pull/331) [`ea68f87`](https://github.com/Pushedskydiver/chief-clancy/commit/ea68f876b7026bbff582c039b9feea119912715f) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Rename `compute*` and `attempt*` functions per verb vocabulary convention.

  **Breaking (dev):** `computeTicketBranch` → `ticketBranch`, `computeTargetBranch` → `targetBranch`, `attemptPrCreation` → `createPr`. Internal: `computeDeliveryOutcome` → `deliveryOutcome`, `computeDrift` → `drift`.

  **Internal (core):** `attemptFetch` → `fetchLoop` (private, not exported).

### Patch Changes

- Updated dependencies [[`ea68f87`](https://github.com/Pushedskydiver/chief-clancy/commit/ea68f876b7026bbff582c039b9feea119912715f)]:
  - @chief-clancy/core@1.0.1

## 0.4.2

### Patch Changes

- [#315](https://github.com/Pushedskydiver/chief-clancy/pull/315) [`5065bb4`](https://github.com/Pushedskydiver/chief-clancy/commit/5065bb4db08d6b046525e02c6a257c72447d170f) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Break two pre-existing madge cycles in `packages/dev/src` via shared-module extracts. Extract `resolveBuildLabel` + `DEFAULT_BUILD_LABEL` to `dep-factory/build-label.ts`; extract `PlatformReworkHandlers` + `ReworkCtx` to `lifecycle/rework/rework-types.ts`. No runtime behaviour change.

## 0.4.1

### Patch Changes

- [#312](https://github.com/Pushedskydiver/chief-clancy/pull/312) [`08b9906`](https://github.com/Pushedskydiver/chief-clancy/commit/08b99061f928ee29b0601bbe841b62e52182d247) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Internal: rewrite deep-path imports to `@chief-clancy/core` per Barrier-Core

  Updates all `@chief-clancy/core/<subpath>/index.js` imports to resolve against declaration files directly, following the core 0.3.0 deletion of internal barrels. No behaviour change for `@chief-clancy/dev` consumers.

- Updated dependencies [[`08b9906`](https://github.com/Pushedskydiver/chief-clancy/commit/08b99061f928ee29b0601bbe841b62e52182d247)]:
  - @chief-clancy/core@1.0.0

## 0.4.0

### Minor Changes

- [#302](https://github.com/Pushedskydiver/chief-clancy/pull/302) [`c2ee440`](https://github.com/Pushedskydiver/chief-clancy/commit/c2ee440d2486333c7ba0073fc110122c6c29f9d6) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Inherited change: published dependency range on `@chief-clancy/core` updates from `^0.1.x` to `^0.2.x` as core adopts the namespaced-subpath `exports` map. (Under pre-1.0 semver the two ranges are disjoint, not overlapping.) No API change in terminal or dev itself — this is a minor bump on the consumer-visible dep surface, not a patch.

### Patch Changes

- Updated dependencies [[`c2ee440`](https://github.com/Pushedskydiver/chief-clancy/commit/c2ee440d2486333c7ba0073fc110122c6c29f9d6)]:
  - @chief-clancy/core@0.2.0

## 0.3.1

### Patch Changes

- [#291](https://github.com/Pushedskydiver/chief-clancy/pull/291) [`7c686cf`](https://github.com/Pushedskydiver/chief-clancy/commit/7c686cffd377c90f3f13e6a52ffce844ba81530f) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Local-init-flow: board-optional path across the pipeline.
  - **dev** — guard `detectBoard` crash paths in both `dev.ts` and `loop-setup.ts` so `loadEnv` returns undefined instead of exiting. Only `dev.ts` routes `--from` to `runLocalMode` (the loop entrypoint doesn't handle `--from`). Exit code preserved via `return process.exit(1)` in `main()` on `loadEnv` failure ([#288](https://github.com/Pushedskydiver/chief-clancy/issues/288)).
  - **terminal** — `/clancy:init` gains a board-optional path with Step 3 board gate, conditional skips for board-specific sections, standalone git-host question (5 options incl. Azure DevOps), local-mode `.env.example` template, local-mode Step 5 enhancement list, and local-mode final output ([#289](https://github.com/Pushedskydiver/chief-clancy/issues/289)). Settings, doctor, help, autopilot, status, and review are now local-mode aware: consistent 6-board detection, new `[B] Connect a board` and `[D] Disconnect board` menu options, doctor gains Shortcut/Notion/AzDO checks, status shows plan inventory gated by the real `.approved` marker, autopilot/review redirect to `/clancy:settings` or `/clancy:implement --from` in local mode ([#290](https://github.com/Pushedskydiver/chief-clancy/issues/290)).

## 0.3.0

### Minor Changes

- [#286](https://github.com/Pushedskydiver/chief-clancy/pull/286) [`404a224`](https://github.com/Pushedskydiver/chief-clancy/commit/404a2240e157ae0d61e627dedcd656551eda0ed6) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add `--from` support to the implement pipeline for local plan execution.

  **dev (minor):** Plan file parser (`parsePlanFile`, `checkApprovalStatus`, `toSyntheticTicket`), local-mode infrastructure (no-op board, synthetic config, local preflight), pipeline wiring for `--from`, directory listing with natural sort (`listPlanFiles`), and public API exports for all plan-file utilities.

  **terminal (patch):** Batch runner (`runImplementBatch`) for `--from {directory} --afk`, implement entry point with directory detection and `--afk` dispatch, workflow and command docs for batch mode, e2e tests for local plan pipeline and lifecycle contracts.

  **plan (patch):** README updated — replaced deferred `implement-from` text with shipped `--from` usage docs pointing at `chief-clancy` and `/clancy:implement`.

  **chief-clancy, core, brief, scan (patch):** README consistency pass — standardised monorepo link ordering (dependency-first), section naming, early-stage warning, and `--from` mentions where applicable.

### Patch Changes

- Updated dependencies [[`404a224`](https://github.com/Pushedskydiver/chief-clancy/commit/404a2240e157ae0d61e627dedcd656551eda0ed6)]:
  - @chief-clancy/core@0.1.2
  - @chief-clancy/scan@0.2.3

## 0.2.1

### Patch Changes

- [#275](https://github.com/Pushedskydiver/chief-clancy/pull/275) [`b3eb148`](https://github.com/Pushedskydiver/chief-clancy/commit/b3eb148d95217593c3d19e471b3bb2884dfda076) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add "Updating" sections to READMEs for per-package update commands and rename `/clancy:update` to `/clancy:update-terminal` in terminal's Setup commands table.

## 0.2.0

### Minor Changes

- [#273](https://github.com/Pushedskydiver/chief-clancy/pull/273) [`951f908`](https://github.com/Pushedskydiver/chief-clancy/commit/951f90877bc1fc1ac20b9da1c8a4201950adcc3d) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add per-package update commands (`/clancy:update-brief`, `/clancy:update-plan`, `/clancy:update-dev`) and rename terminal's `/clancy:update` to `/clancy:update-terminal` with a thin redirect at the old location.

  Each standalone update workflow: version detection via VERSION marker, npm latest check with 5s timeout, changelog from GitHub releases API (URL-encoded tags), terminal coexistence + standalone package advisories, install mode detection (local/global/both), `--afk` confirmation skip, `npx @latest` cache bypass, post-update verification.

  Uninstall workflows updated to list update files for deletion. Installer file lists and printSuccess output updated across all packages.

## 0.1.1

### Patch Changes

- [#267](https://github.com/Pushedskydiver/chief-clancy/pull/267) [`a65c3ee`](https://github.com/Pushedskydiver/chief-clancy/commit/a65c3ee46515b5339f1d1d1e24ed1103e6798e99) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Cross-package uninstall commands. Each standalone package now ships its own uninstall (`/clancy:uninstall-brief`, `/clancy:uninstall-plan`, `/clancy:uninstall-dev`). Terminal's uninstall renamed to `/clancy:uninstall-terminal` with package-aware detection — checks VERSION markers, warns about standalone packages before proceeding, and provides reinstall guidance.

## 0.1.0

### Minor Changes

- [#260](https://github.com/Pushedskydiver/chief-clancy/pull/260) [`fb22c36`](https://github.com/Pushedskydiver/chief-clancy/commit/fb22c36bc4d3ace684ea8f8dfee00364e7c9c137) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Initial public release of @chief-clancy/dev — autonomous ticket executor with readiness gate, AFK loop, and structured artifact reporting. All package READMEs standardised with consistent monorepo section, credits, and license. Terminal bumped to pick up dev 0.1.0 dependency.

### Patch Changes

- Updated dependencies [[`fb22c36`](https://github.com/Pushedskydiver/chief-clancy/commit/fb22c36bc4d3ace684ea8f8dfee00364e7c9c137)]:
  - @chief-clancy/core@0.1.1
  - @chief-clancy/scan@0.2.2

## 0.0.2

### Patch Changes

- Updated dependencies [[`a0c7145`](https://github.com/Pushedskydiver/chief-clancy/commit/a0c71458edc5a38d893ef93e1aa33f4ffea7c368)]:
  - @chief-clancy/scan@0.2.1

## 0.0.1

### Patch Changes

- Updated dependencies [[`a22f4ad`](https://github.com/Pushedskydiver/chief-clancy/commit/a22f4adbd1df9d08c8777a5165824c21d61be029)]:
  - @chief-clancy/scan@0.2.0
