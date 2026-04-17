# @chief-clancy/terminal

## 0.2.10

### Patch Changes

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

- Updated dependencies [[`37e644f`](https://github.com/Pushedskydiver/chief-clancy/commit/37e644f5e3c222350f159d58540dd78d1835e8fa)]:
  - @chief-clancy/core@2.0.0
  - @chief-clancy/dev@0.5.6

## 0.2.9

### Patch Changes

- [#342](https://github.com/Pushedskydiver/chief-clancy/pull/342) [`e7fc21e`](https://github.com/Pushedskydiver/chief-clancy/commit/e7fc21e86d38066091ed04e2a4825b5cbefca2ce) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add missing TSDoc to public-API symbols that were thin on semantics per CONVENTIONS.md §Code Style. `Cached.store` and `CachedMap.store` in `core/src/shared/cache.ts` — document overwrite semantics. `Board.validateInputs` in `core/src/types/board.ts` — clarify that validation is optional and document the error-message-or-undefined return shape. `runReadinessGate` in `dev/src/execute/readiness/readiness-gate.ts` — document green-immediate, red-immediate, yellow-retry behaviour and the subagent-override. `InstallPaths` + `RunInstallOptions` in `terminal/src/installer/install/install.ts` — cross-link to `resolveInstallPaths` for the canonical path shape and document `nonInteractive`/`now` semantics.

- Updated dependencies [[`e7fc21e`](https://github.com/Pushedskydiver/chief-clancy/commit/e7fc21e86d38066091ed04e2a4825b5cbefca2ce)]:
  - @chief-clancy/core@1.0.3
  - @chief-clancy/dev@0.5.5

## 0.2.8

### Patch Changes

- [#340](https://github.com/Pushedskydiver/chief-clancy/pull/340) [`b0b3d81`](https://github.com/Pushedskydiver/chief-clancy/commit/b0b3d81595590e137354decdcb883085233960ee) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Remove TSDoc blocks that restate signatures, per CONVENTIONS.md §Code Style "Delete TSDoc that restates the signature." Surgical preservation where the prose adds genuine semantics (e.g. "Creates the `.clancy` directory if needed", "Bold+blue for contrast on dark backgrounds"). No behaviour change; internal type inference unaffected. Covers `core/src/schemas/env.ts`, `core/src/types/board.ts`, `core/src/types/remote.ts`, `dev/src/lifecycle/lock.ts`, `dev/src/lifecycle/rework/rework.ts`, `dev/src/lifecycle/cost/cost.ts`, `dev/src/lifecycle/quality/quality.ts`, `terminal/src/shared/ansi.ts`, `terminal/src/runner/autopilot.ts`.

- Updated dependencies [[`b0b3d81`](https://github.com/Pushedskydiver/chief-clancy/commit/b0b3d81595590e137354decdcb883085233960ee)]:
  - @chief-clancy/core@1.0.2
  - @chief-clancy/dev@0.5.4

## 0.2.7

### Patch Changes

- [#338](https://github.com/Pushedskydiver/chief-clancy/pull/338) [`061b473`](https://github.com/Pushedskydiver/chief-clancy/commit/061b473c41456ab013046efa15fecf9ddcecd208) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Extract four compound boolean conditions into named constants per CONVENTIONS.md §Code Style "Name compound boolean conditions". `shouldBranchFromEpic` helper in `branch-setup.ts` replaces two duplicate uses of `hasParent && !skipEpicBranch`. Named `const`s replace inline three-part `instanceof`/`'code' in err` checks in `session-report.ts` (ENOENT) and `lock.ts` (EPERM), and the 4-part hours/minutes range check in `queue.ts`.

- Updated dependencies [[`061b473`](https://github.com/Pushedskydiver/chief-clancy/commit/061b473c41456ab013046efa15fecf9ddcecd208)]:
  - @chief-clancy/dev@0.5.3

## 0.2.6

### Patch Changes

- Updated dependencies [[`4ebae37`](https://github.com/Pushedskydiver/chief-clancy/commit/4ebae3700d7aede540410a4b592b289064add443)]:
  - @chief-clancy/dev@0.5.2

## 0.2.5

### Patch Changes

- [#334](https://github.com/Pushedskydiver/chief-clancy/pull/334) [`32145ac`](https://github.com/Pushedskydiver/chief-clancy/commit/32145ac81b16bf30d1fea0cf6d2c84650f2830d1) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Conventions compliance sweep — expression-level fixes (Rules 2, 3, 8).
  Invert 3 empty-fallback ternaries, inline 3 tautological `result`
  variables, and remove 8 section dividers from touched files.
- Updated dependencies [[`32145ac`](https://github.com/Pushedskydiver/chief-clancy/commit/32145ac81b16bf30d1fea0cf6d2c84650f2830d1)]:
  - @chief-clancy/dev@0.5.1

## 0.2.4

### Patch Changes

- Updated dependencies [[`ea68f87`](https://github.com/Pushedskydiver/chief-clancy/commit/ea68f876b7026bbff582c039b9feea119912715f)]:
  - @chief-clancy/dev@0.5.0
  - @chief-clancy/core@1.0.1

## 0.2.3

### Patch Changes

- [#317](https://github.com/Pushedskydiver/chief-clancy/pull/317) [`127adf7`](https://github.com/Pushedskydiver/chief-clancy/commit/127adf749f3a8ff65872ccd07140401727742706) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Break the last pre-existing madge cycle in `packages/terminal/src` by extracting `InstallSources` + `BUNDLE_SCRIPTS` from `installer/install/install.ts` to a new `installer/install/install-shared.ts`. `InstallSources` added to the public type surface. No runtime behaviour change.

## 0.2.2

### Patch Changes

- Updated dependencies [[`5065bb4`](https://github.com/Pushedskydiver/chief-clancy/commit/5065bb4db08d6b046525e02c6a257c72447d170f)]:
  - @chief-clancy/dev@0.4.2

## 0.2.1

### Patch Changes

- Updated dependencies [[`08b9906`](https://github.com/Pushedskydiver/chief-clancy/commit/08b99061f928ee29b0601bbe841b62e52182d247), [`08b9906`](https://github.com/Pushedskydiver/chief-clancy/commit/08b99061f928ee29b0601bbe841b62e52182d247)]:
  - @chief-clancy/core@1.0.0
  - @chief-clancy/dev@0.4.1

## 0.2.0

### Minor Changes

- [#302](https://github.com/Pushedskydiver/chief-clancy/pull/302) [`c2ee440`](https://github.com/Pushedskydiver/chief-clancy/commit/c2ee440d2486333c7ba0073fc110122c6c29f9d6) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Inherited change: published dependency range on `@chief-clancy/core` updates from `^0.1.x` to `^0.2.x` as core adopts the namespaced-subpath `exports` map. (Under pre-1.0 semver the two ranges are disjoint, not overlapping.) No API change in terminal or dev itself — this is a minor bump on the consumer-visible dep surface, not a patch.

### Patch Changes

- Updated dependencies [[`c2ee440`](https://github.com/Pushedskydiver/chief-clancy/commit/c2ee440d2486333c7ba0073fc110122c6c29f9d6), [`c2ee440`](https://github.com/Pushedskydiver/chief-clancy/commit/c2ee440d2486333c7ba0073fc110122c6c29f9d6)]:
  - @chief-clancy/core@0.2.0
  - @chief-clancy/dev@0.4.0

## 0.1.15

### Patch Changes

- [#291](https://github.com/Pushedskydiver/chief-clancy/pull/291) [`7c686cf`](https://github.com/Pushedskydiver/chief-clancy/commit/7c686cffd377c90f3f13e6a52ffce844ba81530f) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Local-init-flow: board-optional path across the pipeline.
  - **dev** — guard `detectBoard` crash paths in both `dev.ts` and `loop-setup.ts` so `loadEnv` returns undefined instead of exiting. Only `dev.ts` routes `--from` to `runLocalMode` (the loop entrypoint doesn't handle `--from`). Exit code preserved via `return process.exit(1)` in `main()` on `loadEnv` failure ([#288](https://github.com/Pushedskydiver/chief-clancy/issues/288)).
  - **terminal** — `/clancy:init` gains a board-optional path with Step 3 board gate, conditional skips for board-specific sections, standalone git-host question (5 options incl. Azure DevOps), local-mode `.env.example` template, local-mode Step 5 enhancement list, and local-mode final output ([#289](https://github.com/Pushedskydiver/chief-clancy/issues/289)). Settings, doctor, help, autopilot, status, and review are now local-mode aware: consistent 6-board detection, new `[B] Connect a board` and `[D] Disconnect board` menu options, doctor gains Shortcut/Notion/AzDO checks, status shows plan inventory gated by the real `.approved` marker, autopilot/review redirect to `/clancy:settings` or `/clancy:implement --from` in local mode ([#290](https://github.com/Pushedskydiver/chief-clancy/issues/290)).

- Updated dependencies [[`7c686cf`](https://github.com/Pushedskydiver/chief-clancy/commit/7c686cffd377c90f3f13e6a52ffce844ba81530f)]:
  - @chief-clancy/dev@0.3.1

## 0.1.14

### Patch Changes

- [#286](https://github.com/Pushedskydiver/chief-clancy/pull/286) [`404a224`](https://github.com/Pushedskydiver/chief-clancy/commit/404a2240e157ae0d61e627dedcd656551eda0ed6) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add `--from` support to the implement pipeline for local plan execution.

  **dev (minor):** Plan file parser (`parsePlanFile`, `checkApprovalStatus`, `toSyntheticTicket`), local-mode infrastructure (no-op board, synthetic config, local preflight), pipeline wiring for `--from`, directory listing with natural sort (`listPlanFiles`), and public API exports for all plan-file utilities.

  **terminal (patch):** Batch runner (`runImplementBatch`) for `--from {directory} --afk`, implement entry point with directory detection and `--afk` dispatch, workflow and command docs for batch mode, e2e tests for local plan pipeline and lifecycle contracts.

  **plan (patch):** README updated — replaced deferred `implement-from` text with shipped `--from` usage docs pointing at `chief-clancy` and `/clancy:implement`.

  **chief-clancy, core, brief, scan (patch):** README consistency pass — standardised monorepo link ordering (dependency-first), section naming, early-stage warning, and `--from` mentions where applicable.

- Updated dependencies [[`404a224`](https://github.com/Pushedskydiver/chief-clancy/commit/404a2240e157ae0d61e627dedcd656551eda0ed6)]:
  - @chief-clancy/dev@0.3.0
  - @chief-clancy/core@0.1.2

## 0.1.13

### Patch Changes

- [#275](https://github.com/Pushedskydiver/chief-clancy/pull/275) [`b3eb148`](https://github.com/Pushedskydiver/chief-clancy/commit/b3eb148d95217593c3d19e471b3bb2884dfda076) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add "Updating" sections to READMEs for per-package update commands and rename `/clancy:update` to `/clancy:update-terminal` in terminal's Setup commands table.

- Updated dependencies [[`b3eb148`](https://github.com/Pushedskydiver/chief-clancy/commit/b3eb148d95217593c3d19e471b3bb2884dfda076)]:
  - @chief-clancy/dev@0.2.1

## 0.1.12

### Patch Changes

- [#273](https://github.com/Pushedskydiver/chief-clancy/pull/273) [`951f908`](https://github.com/Pushedskydiver/chief-clancy/commit/951f90877bc1fc1ac20b9da1c8a4201950adcc3d) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add per-package update commands (`/clancy:update-brief`, `/clancy:update-plan`, `/clancy:update-dev`) and rename terminal's `/clancy:update` to `/clancy:update-terminal` with a thin redirect at the old location.

  Each standalone update workflow: version detection via VERSION marker, npm latest check with 5s timeout, changelog from GitHub releases API (URL-encoded tags), terminal coexistence + standalone package advisories, install mode detection (local/global/both), `--afk` confirmation skip, `npx @latest` cache bypass, post-update verification.

  Uninstall workflows updated to list update files for deletion. Installer file lists and printSuccess output updated across all packages.

- Updated dependencies [[`951f908`](https://github.com/Pushedskydiver/chief-clancy/commit/951f90877bc1fc1ac20b9da1c8a4201950adcc3d)]:
  - @chief-clancy/dev@0.2.0

## 0.1.11

### Patch Changes

- [#267](https://github.com/Pushedskydiver/chief-clancy/pull/267) [`a65c3ee`](https://github.com/Pushedskydiver/chief-clancy/commit/a65c3ee46515b5339f1d1d1e24ed1103e6798e99) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Cross-package uninstall commands. Each standalone package now ships its own uninstall (`/clancy:uninstall-brief`, `/clancy:uninstall-plan`, `/clancy:uninstall-dev`). Terminal's uninstall renamed to `/clancy:uninstall-terminal` with package-aware detection — checks VERSION markers, warns about standalone packages before proceeding, and provides reinstall guidance.

- Updated dependencies [[`a65c3ee`](https://github.com/Pushedskydiver/chief-clancy/commit/a65c3ee46515b5339f1d1d1e24ed1103e6798e99)]:
  - @chief-clancy/dev@0.1.1

## 0.1.10

### Patch Changes

- [#260](https://github.com/Pushedskydiver/chief-clancy/pull/260) [`fb22c36`](https://github.com/Pushedskydiver/chief-clancy/commit/fb22c36bc4d3ace684ea8f8dfee00364e7c9c137) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Initial public release of @chief-clancy/dev — autonomous ticket executor with readiness gate, AFK loop, and structured artifact reporting. All package READMEs standardised with consistent monorepo section, credits, and license. Terminal bumped to pick up dev 0.1.0 dependency.

- Updated dependencies [[`fb22c36`](https://github.com/Pushedskydiver/chief-clancy/commit/fb22c36bc4d3ace684ea8f8dfee00364e7c9c137)]:
  - @chief-clancy/dev@0.1.0
  - @chief-clancy/core@0.1.1

## 0.1.9

### Patch Changes

- [#248](https://github.com/Pushedskydiver/chief-clancy/pull/248) [`a0c7145`](https://github.com/Pushedskydiver/chief-clancy/commit/a0c71458edc5a38d893ef93e1aa33f4ffea7c368) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add scan README and update all package READMEs with scan references.

- Updated dependencies []:
  - @chief-clancy/dev@0.0.2

## 0.1.8

### Patch Changes

- [#246](https://github.com/Pushedskydiver/chief-clancy/pull/246) [`a22f4ad`](https://github.com/Pushedskydiver/chief-clancy/commit/a22f4adbd1df9d08c8777a5165824c21d61be029) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - New `@chief-clancy/scan` package — shared codebase scanning agents and workflows (map-codebase, update-docs) consumed by dev, brief, plan, and terminal. Single source of truth replaces per-package duplicates.

- Updated dependencies []:
  - @chief-clancy/dev@0.0.1

## 0.1.7

### Patch Changes

- [#220](https://github.com/Pushedskydiver/chief-clancy/pull/220) [`f850376`](https://github.com/Pushedskydiver/chief-clancy/commit/f85037685e1710dbdde86158ecef174cb8df19fc) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - ✨ feat(brief): absorb approve-brief from terminal strategist

  Move `/clancy:approve-brief` command + workflow into `@chief-clancy/brief`,
  making approve-brief installable via `npx @chief-clancy/brief --local` /
  `--global` alongside `/clancy:brief` and `/clancy:board-setup`. The terminal
  strategist directory is deleted entirely; strategist joins planner as a
  virtual role (config-gate concept in `installer/ui.ts` + `brief-content.ts`,
  no on-disk role files).

  `@chief-clancy/terminal` is a patch because there's no public API change —
  the workflow files moved are still installed by terminal via `brief-content.ts`,
  just sourced from the brief package instead of a local strategist directory.
  The `brief-content.ts` installer was refactored from scalar constants to
  arrays to accommodate the second command/workflow file.

## 0.1.6

### Patch Changes

- [#207](https://github.com/Pushedskydiver/chief-clancy/pull/207) [`fc289b6`](https://github.com/Pushedskydiver/chief-clancy/commit/fc289b60e8a15c5dec758f970b19821e5102be7f) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Move `/clancy:approve-plan` (command + workflow) from `@chief-clancy/terminal`'s planner role into `@chief-clancy/plan` as the new single source of truth. Terminal installs (`npx chief-clancy`) now source the same files via the existing `plan-content` installer module — terminal users see no behaviour change. The standalone installer (`npx @chief-clancy/plan`) deliberately does NOT ship `approve-plan.md` yet: the workflow content is currently board-only and would surface as a broken command for plan-standalone users. The next PR makes the workflow standalone-safe (three-state detection + local `.approved` marker) and wires it into the standalone installer at the same time. Workflow content is byte-identical to the previous terminal version.

## 0.1.5

### Patch Changes

- [#198](https://github.com/Pushedskydiver/chief-clancy/pull/198) [`5f8b6ab`](https://github.com/Pushedskydiver/chief-clancy/commit/5f8b6abaf394bc7a950baf98988467431d5295b6) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Initial release of @chief-clancy/plan — standalone implementation planner for Claude Code. Ships /clancy:plan and /clancy:board-setup commands with three-state mode detection. Terminal consumes plan content via plan-content module; wrapper wires plan sources.

## 0.1.4

### Patch Changes

- Fix statusline showing 100% context used at session start by treating remaining_percentage: 0 as uninitialized data.

## 0.1.3

### Patch Changes

- [#182](https://github.com/Pushedskydiver/chief-clancy/pull/182) [`e6f6fef`](https://github.com/Pushedskydiver/chief-clancy/commit/e6f6fefb8593f348f97a424dfa91530a31687947) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Fix hook errors: add required `matcher` field to settings.json hook entries, replace detached child process in check-update with synchronous npm check (5s timeout), and show installed version in the statusline.

## 0.1.2

### Patch Changes

- [#181](https://github.com/Pushedskydiver/chief-clancy/pull/181) [`e6953c8`](https://github.com/Pushedskydiver/chief-clancy/commit/e6953c8475a92317c2e5d2ebbde5ea9f8542f5e6) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Fix PreToolUse hook output format to match Claude Code's hookSpecificOutput envelope. Hooks now return `permissionDecision: "allow"|"deny"` instead of the deprecated `decision: "approve"|"block"` format. Resolves "hook error" messages in Claude Code v2.1.85+.

## 0.1.1

### Patch Changes

- [#179](https://github.com/Pushedskydiver/chief-clancy/pull/179) [`9555ae0`](https://github.com/Pushedskydiver/chief-clancy/commit/9555ae07b8ed92ccef7b56ce3338737e05cbe42b) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add runtime bundles (clancy-implement.js, clancy-autopilot.js) built by esbuild. The installer now copies self-contained ESM scripts to `.clancy/` that can run without npm dependencies.
