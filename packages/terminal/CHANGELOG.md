# @chief-clancy/terminal

## 0.5.0

### Minor Changes

- [#419](https://github.com/Pushedskydiver/chief-clancy/pull/419) [`a717ac3`](https://github.com/Pushedskydiver/chief-clancy/commit/a717ac36003d8b70b83b935eb5fe8a8251da71cd) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Move `.clancy/` to fully gitignored.

  `/clancy:init` (terminal) now writes `.clancy/` to `.gitignore` (covering all artifacts including `.env`, `.env.example`, `docs/`, `version.json`, `package.json`, and bundled scripts). The init scaffold commit stages only parent-project files (`CLAUDE.md` + `.gitignore`).

  `/clancy:map-codebase` and `/clancy:update-docs` (scan) no longer commit; their writes are local-only.

  `/clancy:uninstall-terminal` accepts both new (`.clancy/`) and legacy (`.clancy/.env`) gitignore markers and removes ALL Clancy marker pairs found (legacy and current may coexist after migration). New Step 5b commits the parent-project cleanup (CLAUDE.md + .gitignore) before offering to remove `.clancy/`.

  `/clancy:update-terminal` prints a one-time migration advisory (idempotent against partial state) for projects that were init'd before the gitignore fold and still have tracked content under `.clancy/`. The advisory prints branch-conditional commands (including `git add .gitignore` to stage the gitignore append).

  Standalone packages (`@chief-clancy/brief`, `@chief-clancy/plan`, `@chief-clancy/dev`) board-setup workflows now suggest gitignoring `.clancy/` (not the legacy `.clancy/.env`) for symmetric treatment with terminal — covers credentials plus all local Clancy artifacts.

  Migration: existing projects with tracked `.clancy/` content will see the advisory after running `/clancy:update-terminal`. Run the printed commands to migrate.

### Patch Changes

- Updated dependencies [[`a717ac3`](https://github.com/Pushedskydiver/chief-clancy/commit/a717ac36003d8b70b83b935eb5fe8a8251da71cd)]:
  - @chief-clancy/dev@0.12.0

## 0.4.1

### Patch Changes

- [#416](https://github.com/Pushedskydiver/chief-clancy/pull/416) [`19a2d0a`](https://github.com/Pushedskydiver/chief-clancy/commit/19a2d0a9e9d2e3d6f9b68b2f20a8644e4ed150e1) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - The `feasibility`, `invoke`, and `deliver` pipeline phases now return tagged
  `{ ok: false, error: { kind, message } }` results, matching the shape
  established for `preflight`, `ticketFetch`, and `branchSetup` in [#357](https://github.com/Pushedskydiver/chief-clancy/issues/357) / [#359](https://github.com/Pushedskydiver/chief-clancy/issues/359).
  - **Feasibility** (`PipelineDeps.feasibility`): `{ ok: true; skipped: boolean }`
    on success; `{ ok: false; error: { kind: 'not-feasible' | 'check-failed';
message: string } }` on failure. The `check-failed` kind is shape parity —
    `checkFeasibility` remains fail-open at the lifecycle layer, so the variant
    is unreachable in practice.
  - **Invoke** (`PipelineDeps.invoke`): consumes the captured stderr from
    PR-1's `invokeClaudeSession` and surfaces it as `error.message`. Falls
    back to `'Claude session exited non-zero (no stderr captured)'` when
    stderr is empty.
  - **Deliver** (`PipelineDeps.deliver`): tagged `'push-failed'` when
    `pushBranch` returns false (generic message — capturing git stderr is
    deferred to a `pushBranch` upgrade). Tagged `'pr-creation-failed'` when
    push succeeds but the PR API call returned a tagged error (excludes
    the `alreadyExists` case).

  The terminal display now surfaces `error.message` on aborted pipelines so
  operators see why a phase halted.

  **Behaviour change.** PR-creation failure (push succeeded, PR API failed)
  now halts the deliver phase as `ok: false` and writes a new
  `PR_CREATION_FAILED` progress status (additive enum on
  `@chief-clancy/core`). Previously the failure was silently mapped to
  `PUSHED` and the loop continued through `recordDelivery` / `cost` /
  `cleanup`. The new failure branch correctly skips `recordDelivery`,
  `removeBuildLabel`, `cost`, and `cleanup` for failed deliveries; the
  autopilot loop continues to the next ticket per `stop-condition.ts`'s
  `deliver`-non-fatal classification.

  **`PR_CREATION_FAILED` status-set membership.** Added to `FAILED_STATUSES`
  (operator-visible failure surface — counted in AFK session reports
  alongside `PUSH_FAILED` / `SKIPPED` / `TIME_LIMIT`). Deliberately NOT
  added to `DELIVERED_STATUSES`: the branch is on the remote, but classifying
  it as already-delivered would let `resume.ts` skip the manual retry path,
  defeating the operator-driven retry contract. NOT added to
  `COMPLETED_STATUSES`: the work is not completed when PR creation fails.
  `pr-retry` (which scans for `PUSHED`) does not auto-retry these — operator
  intervention is the contract.

  **Round-trip-safe parser.** `dev/lifecycle/progress.ts:VALID_STATUSES`
  extended to include `PR_CREATION_FAILED` so `parseProgressFile` round-trips
  the new entries (regression test added covering every literal in
  `ProgressStatus`).

- Updated dependencies [[`19a2d0a`](https://github.com/Pushedskydiver/chief-clancy/commit/19a2d0a9e9d2e3d6f9b68b2f20a8644e4ed150e1)]:
  - @chief-clancy/dev@0.11.0
  - @chief-clancy/core@4.0.1

## 0.4.0

### Minor Changes

- [`08b7a79`](https://github.com/Pushedskydiver/chief-clancy/commit/08b7a79159aeb22ae33841de9bf3bcb1f0000229) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - `invokeClaudeSession` switches to async streaming spawn and returns
  `Promise<{ ok, stderr }>` with the trailing 4096-char tail of captured
  stderr (UTF-16 code units, not bytes — for ASCII the two are equivalent).
  `invokeClaudePrint` adds `stderr` to its existing `{ stdout, ok }` return.
  A new `StreamingSpawnFn` type + `streamingSpawn` field on
  `buildPipelineDeps` opts let the terminal entrypoint inject a real-Node
  streaming spawn (via `child_process.spawn`) that tees child stdout/stderr
  live to the operator while accumulating buffers for downstream phases to
  surface failure context. PR-2 will widen the invoke phase consumer to
  forward the captured stderr through the tagged-error union.

### Patch Changes

- Updated dependencies [[`08b7a79`](https://github.com/Pushedskydiver/chief-clancy/commit/08b7a79159aeb22ae33841de9bf3bcb1f0000229)]:
  - @chief-clancy/dev@0.10.0

## 0.3.3

### Patch Changes

- [#400](https://github.com/Pushedskydiver/chief-clancy/pull/400) [`b393d6b`](https://github.com/Pushedskydiver/chief-clancy/commit/b393d6b6d0078d12c6b40127aba6af5850b0fb9c) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Fix documentation drift around the `needs-refinement` / `CLANCY_PLAN_LABEL` deprecation.
  - `packages/plan/src/workflows/plan.md`: tighten empty-queue GitHub guidance — drop the redundant `needs-refinement` mention from the fallback parenthetical; keep `CLANCY_LABEL_PLAN` (default: `clancy:plan`) with `CLANCY_PLAN_LABEL` as legacy fallback.
  - `packages/terminal/src/roles/setup/workflows/scaffold.md`: remove a stale `.env.example` block that presented `CLANCY_PLAN_LABEL="needs-refinement"` as current — the pipeline-labels block later in the same file already handles this correctly via `CLANCY_LABEL_PLAN="clancy:plan"` with the deprecated-var note.

  Repo-internal docs (`docs/roles/PLANNER.md`) also updated to match the canonical form in `docs/guides/CONFIGURATION.md`.

## 0.3.2

### Patch Changes

- [#398](https://github.com/Pushedskydiver/chief-clancy/pull/398) [`01fbf7d`](https://github.com/Pushedskydiver/chief-clancy/commit/01fbf7d2b229bb30c3a0f099060bb8196a458798) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Fix duplicate `CLANCY_LABEL_PLAN` write to `.clancy/.env` on `npx chief-clancy` init (GitHub + Planner) and in the `/clancy:settings` menu.

  Root cause: two separate prompts in the init and settings workflows both wrote to `CLANCY_LABEL_PLAN` with different defaults (`clancy:plan` vs `needs-refinement`) — the second write created a duplicate key, which agent-Claude then had to patch up (and could drop adjacent env vars in the process on larger `.env` files).

  Removed the redundant GitHub-only prompts in both workflows. Pipeline Labels (Step 4c-2 in init, `[L2]` in settings) is now the single source of truth for `CLANCY_LABEL_PLAN`. Jira (`CLANCY_PLAN_STATUS`) and Linear (`CLANCY_PLAN_STATE_TYPE`) branches unchanged — those are genuinely distinct concepts.

## 0.3.1

### Patch Changes

- Updated dependencies [[`c9392f8`](https://github.com/Pushedskydiver/chief-clancy/commit/c9392f8d6831f677a0869f92b22d3eaf6bf3e82f)]:
  - @chief-clancy/dev@0.9.0

## 0.3.0

### Minor Changes

- [#357](https://github.com/Pushedskydiver/chief-clancy/pull/357) [`a537c93`](https://github.com/Pushedskydiver/chief-clancy/commit/a537c937f7484822ca225fd8a4ae544b24d60772) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Migrate `PipelineDeps` inline error contracts to the tagged `{ kind: 'unknown'; message: string }` house shape per `docs/CONVENTIONS.md` §Error Handling. Completes the sweep started by the `branchSetup` migration in PR-I.

  **Breaking (pre-1.0 minor):** `PipelineDeps` is re-exported from `@chief-clancy/dev`'s public surface, so consumers who type against `PipelineDeps.preflight` / `PipelineDeps.ticketFetch` on the failure branch will see a shape change from `{ error?: string }` to `{ error: { kind: 'unknown'; message: string } }` (preflight) or `{ error?: { kind: 'unknown'; message: string } }` (ticketFetch).

  **Changes:**
  - `PipelineDeps.preflight` — migrated to tagged `{ ok: true } | { ok: false; error: { kind; message } }`. `PreflightPhaseResult` + `PreflightCheckResult` in `pipeline/phases/preflight-phase.ts` also migrated and do carry `warning?: string` on both branches (the phase-alias is the warning-carrying surface; the pipeline-level inline contract intentionally omits warning since the outer `PipelineResult` has no display channel for it). `wirePreflight` adapts the legacy `runPreflight` (`lifecycle/preflight/preflight.ts`) to the tagged shape via a `runPreflightTagged` helper — the legacy file itself is untouched and slated for a follow-up peer sweep.
  - `PipelineDeps.ticketFetch` — migrated to tagged shape. The `TicketFetchResult` phase alias itself has no `error` field; errors originate only in dep-factory's `runTicketFetch` wrapper via `localTicketSeed`, which now forwards the tagged `seed.error` directly.
  - `PipelineDeps.feasibility` / `invoke` / `deliver` — dropped dead `error?: string` fields. The phase-impls never populated them (`FeasibilityPhaseResult`, `makeInvokePhase` return type, `DeliverPhaseResult` all have no `error` field), so the three `.error` reads in `run-pipeline.ts` always evaluated to `undefined`. No phase-impl changes; whether to plumb real error channels through these three phases is a separate design decision deferred to a future workstream.

  **Remaining legacy sites (follow-up sweep):** 4 `error: string` sites on execute/lifecycle paths — `execute/single.ts` `GateResult`, `execute/readiness/readiness-gate.ts` `GateFailed`, `execute/flags/readiness-flags.ts` readiness-flags literal, `lifecycle/preflight/preflight.ts` `PreflightResult`. Tracked by the new `TODO(legacy-error-shape-sweep)` anchor at `execute/single.ts`.

  **Follow-up bug fix (same sweep):** Copilot flagged that `wirePreflight` was adapting a git-only `ExecGit` into `PreflightDeps.exec` (an arbitrary-binary executor) — so binary probes like `claude --version` became `git claude --version` and failed unconditionally. Fix threads a separate `execCmd: ExecCmd` dep through `DepFactoryOpts`/`wirePreflight`/terminal's pipeline-wiring; new `makeExecCmd` adapters in both `dev/entrypoints/adapters.ts` and `terminal/entrypoints/implement.ts` spawn arbitrary binaries correctly. `ExecCmd` is now re-exported from `@chief-clancy/dev` for terminal's consumption.

  **Terminal breaking surface:** `@chief-clancy/terminal` re-exports `buildPipelineDeps` from `@chief-clancy/dev` and exports `runImplement` directly — both now require `execCmd: ExecCmd` on their opts. Pre-1.0 minor bump per PR-I / PR-J precedent for breaking public-type changes.

### Patch Changes

- Updated dependencies [[`a537c93`](https://github.com/Pushedskydiver/chief-clancy/commit/a537c937f7484822ca225fd8a4ae544b24d60772)]:
  - @chief-clancy/dev@0.8.0

## 0.2.15

### Patch Changes

- Updated dependencies [[`48e2bfb`](https://github.com/Pushedskydiver/chief-clancy/commit/48e2bfbb49f75087641b815c71f752f5b66c3045)]:
  - @chief-clancy/dev@0.7.1

## 0.2.14

### Patch Changes

- Updated dependencies [[`5abe943`](https://github.com/Pushedskydiver/chief-clancy/commit/5abe943051838531d376bab344860d7309d878b7)]:
  - @chief-clancy/dev@0.7.0

## 0.2.13

### Patch Changes

- Updated dependencies [[`66b8f90`](https://github.com/Pushedskydiver/chief-clancy/commit/66b8f90ffe8ab1ef3f9f5271df50798aa16d3ad8)]:
  - @chief-clancy/dev@0.6.0

## 0.2.12

### Patch Changes

- Updated dependencies [[`6a37bd1`](https://github.com/Pushedskydiver/chief-clancy/commit/6a37bd15d393ca7d96f2708c5b9142ad6fbc6cdb)]:
  - @chief-clancy/core@4.0.0
  - @chief-clancy/dev@0.5.8

## 0.2.11

### Patch Changes

- Updated dependencies [[`a26dcd8`](https://github.com/Pushedskydiver/chief-clancy/commit/a26dcd8fe4adbed17c5b204b4e0646014d644e18)]:
  - @chief-clancy/core@3.0.0
  - @chief-clancy/dev@0.5.7

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
