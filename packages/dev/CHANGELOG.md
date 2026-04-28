# @chief-clancy/dev

## 0.12.0

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
  - @chief-clancy/scan@0.3.0

## 0.11.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [[`19a2d0a`](https://github.com/Pushedskydiver/chief-clancy/commit/19a2d0a9e9d2e3d6f9b68b2f20a8644e4ed150e1)]:
  - @chief-clancy/core@4.0.1

## 0.10.0

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

## 0.9.0

### Minor Changes

- [#359](https://github.com/Pushedskydiver/chief-clancy/pull/359) [`c9392f8`](https://github.com/Pushedskydiver/chief-clancy/commit/c9392f8d6831f677a0869f92b22d3eaf6bf3e82f) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Complete the tagged-error-shape sweep — the 4 peer sites deferred from the pipeline sweep in 0.8.0 (tracked by the `TODO(legacy-error-shape-sweep)` anchor at `execute/single.ts`) are now migrated to the house `{ kind: 'unknown'; message: string }` shape per `docs/CONVENTIONS.md` §Error Handling.

  **Breaking (pre-1.0 minor):** four public-API-adjacent surfaces change shape on the failure branch:
  - `ReadinessFlagsResult.error` — the failure branch of `parseReadinessFlags`'s return type changes from `error: string` to `error: { kind: 'unknown'; message: string }`. `parseReadinessFlags` is re-exported from `@chief-clancy/dev`.
  - `GateFailed.error` — the failure branch of `runReadinessGate`'s return type changes from `error?: string` to `error?: { kind: 'unknown'; message: string }`. `runReadinessGate` is re-exported from `@chief-clancy/dev`.
  - `SingleTicketDeps.readinessGate` — the injected readiness-gate function's return type (a structurally-duplicated `GateResult` in `execute/single.ts`) gets the same shape change. `SingleTicketDeps` is re-exported from `@chief-clancy/dev`.
  - `PreflightResult` — migrated to a discriminated union matching `PreflightCheckResult` (the pipeline-phase alias) exactly: `{ ok: true; warning?; env? } | { ok: false; error: { kind; message }; warning? }`. `runPreflight` is re-exported from `@chief-clancy/dev` (the return type is observable via inference).

  **Consumer cascades (internal):** `execute/single.ts`'s `checkReadiness` extracts `.message` at two call sites that previously assigned the bare-string error directly into `PipelineResult.error` (a display-only boundary surface that stays `string`).

  **Simplification:** `runPreflightTagged` adapter in `dep-factory/local-wiring.ts` is deleted — once `PreflightResult` itself is the tagged shape, the translation layer is unnecessary. `wirePreflight` calls `runPreflight` directly.

  **Scope closed:** the `TODO(legacy-error-shape-sweep)` anchor at `execute/single.ts` is removed. No further error-shape migrations are tracked.

## 0.8.0

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

## 0.7.1

### Patch Changes

- [#355](https://github.com/Pushedskydiver/chief-clancy/pull/355) [`48e2bfb`](https://github.com/Pushedskydiver/chief-clancy/commit/48e2bfbb49f75087641b815c71f752f5b66c3045) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Fix `postPullRequest` missing-field guard: `if (!parsed.url && !parsed.number)` → `||` so the failure branch triggers when EITHER the parsed URL OR the parsed number is falsy, not only when both are. Previously a partial parse (e.g. `{ ok: true, url: '', number: 42 }` or `{ ok: true, url: '...', number: 0 }`) would return a "success" with a broken PR reference. Error message updated from "missing URL and number" → "missing URL or number" to match. Added two tests covering the previously-silent one-of-two-missing cases. Caught by Copilot on PR-H [#348](https://github.com/Pushedskydiver/chief-clancy/issues/348) and deferred; now resolved.

## 0.7.0

### Minor Changes

- [#352](https://github.com/Pushedskydiver/chief-clancy/pull/352) [`5abe943`](https://github.com/Pushedskydiver/chief-clancy/commit/5abe943051838531d376bab344860d7309d878b7) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - **BREAKING** — `parsePlanFile` in `@chief-clancy/dev` (re-exported from `src/index.ts`) now returns a tagged Result instead of throwing on malformed plan files:

  ```ts
  // Before
  const plan = parsePlanFile(content, slug); // throws on missing header

  // After
  const result = parsePlanFile(content, slug);
  if (!result.ok) {
    // result.error.kind === 'unknown', result.error.message contains the detail
    return handleFailure(result.error.message);
  }
  const plan = result.plan;
  ```

  Per CONVENTIONS.md §Error Handling — a malformed plan file is user-triggerable (the caller supplies `--from <plan-path>` pointing at `.clancy/plans/*.md`), so it's an expected-failure surface, not an invariant. Minor bump (pre-1.0 breaking) consistent with the PR-I precedent: return shapes of `src/index.ts`-exported functions are observable public contract.

  Internal consumer `localTicketSeed` also migrated to return the tagged Result (with `fromPath` added to the error message for context) rather than re-throwing, so the failure propagates through the pipeline's existing `ticketFetch` Result channel with proper phase attribution. `dep-factory.ts`'s `ticketFetch` closure extracted to a named `runTicketFetch` helper to keep `wireTicketPhases` under the 50-line cap.

## 0.6.0

### Minor Changes

- [#350](https://github.com/Pushedskydiver/chief-clancy/pull/350) [`66b8f90`](https://github.com/Pushedskydiver/chief-clancy/commit/66b8f90ffe8ab1ef3f9f5271df50798aa16d3ad8) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - **BREAKING** — Migrate 6 dev result shapes from `error: string` to the tagged house shape `{ kind: 'unknown'; message: string }` per CONVENTIONS.md §Error Handling. Minor bump (pre-1.0) — the shape change is observable through `@chief-clancy/dev`'s public `src/index.ts` re-exports (`ensureEpicBranch`, `executeResume`, `invokeReadinessGrade`) and the `PipelineDeps.branchSetup` type. Consumers must read `result.error.message` where they previously read `result.error`.

  Migrated:
  - `EnsureEpicResult` — both copies (`lifecycle/epic.ts` and the duplicate in `pipeline/phases/branch-setup.ts`)
  - `BranchSetupResult` (`pipeline/phases/branch-setup.ts`) and the inline `PipelineDeps.branchSetup` contract in `pipeline/run-pipeline.ts`
  - `ResumeExecResult` — both the real result in `lifecycle/resume/resume.ts` (now a proper discriminated union with `prResult?` only on the ok branch) and the narrow duplicate in `pipeline/phases/lock-check.ts`
  - `ParseFailure` (`agents/parse-verdict.ts`)
  - `InvokeResult` (`agents/invoke.ts`)
  - `GradeResult` — both copies (`execute/readiness/readiness-gate.ts` and `artifacts/preflight-batch.ts`)

  Cascade updates: `run-pipeline.ts` extracts `branch.error.message` for the string-typed `PipelineResult.error`; `readiness-gate.ts` extracts `result.error.message` for its outer `GateFailed.error`; `preflight-batch.ts` extracts `result.error.message` into the synthetic red verdict reason. Test assertions use `toMatchObject({ error: { kind, message } })` or `.error.message` after narrowing.

  **Explicitly scoped out** (deferred for a follow-up sweep): the 5 other inline `{ ok: boolean; error?: string }` peer contracts in `PipelineDeps` (`preflight`, `ticketFetch`, `feasibility`, `invoke`, `deliver`). Only `branchSetup` was migrated in this PR because it was forced by the `BranchSetupResult` cascade; the rest are independent phase-result types and belong in a dedicated pipeline-phase sweep.

## 0.5.8

### Patch Changes

- [#348](https://github.com/Pushedskydiver/chief-clancy/pull/348) [`6a37bd1`](https://github.com/Pushedskydiver/chief-clancy/commit/6a37bd15d393ca7d96f2708c5b9142ad6fbc6cdb) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - **BREAKING** — `PrCreationFailure` in `@chief-clancy/core/types/remote.js` now carries a tagged error channel per CONVENTIONS.md §Error Handling:

  ```ts
  // Before
  type PrCreationFailure = {
    ok: false;
    error: string;
    alreadyExists?: boolean;
  };

  // After
  type PrCreationFailure = {
    ok: false;
    error: { kind: 'unknown'; message: string };
    alreadyExists?: boolean;
  };
  ```

  Ergonomically close to a bare string but on a typed chassis — future widening adds variants (`kind: 'network'`, `kind: 'auth'`) without string parsing. Consumers must read `result.error.message` where they previously read `result.error`. `postPullRequest` helper (the single source of failure construction for all 5 git-host paths: github, gitlab, azdo, bitbucket cloud, bitbucket server) + `deliveryOutcome` consumer updated. ~10 test assertion sites migrated.

  Semver: `major` (3.0.0 → 4.0.0). The Session 96 plan originally called for patch scoped to "2.0.x" under the assumption that PR-G + PR-G2 + PR-H would all batch into a single 2.0.0. Since PR-G and PR-G2 shipped as separate majors (2.0.0 and 3.0.0 respectively), PR-H's public-type shape change is its own breaking release — consistent with the precedents already set.

- Updated dependencies [[`6a37bd1`](https://github.com/Pushedskydiver/chief-clancy/commit/6a37bd15d393ca7d96f2708c5b9142ad6fbc6cdb)]:
  - @chief-clancy/core@4.0.0

## 0.5.7

### Patch Changes

- [#345](https://github.com/Pushedskydiver/chief-clancy/pull/345) [`a26dcd8`](https://github.com/Pushedskydiver/chief-clancy/commit/a26dcd8fe4adbed17c5b204b4e0646014d644e18) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - **BREAKING** — `PrReviewState.changesRequested` in `@chief-clancy/core/types/remote.js` is renamed to `PrReviewState.hasChangesRequested` per CONVENTIONS.md §Code Style Rule 13 (boolean naming: `is*/has*/can*/should*` prefix). Reads as a question at call sites (`if (reviewState?.hasChangesRequested)`).

  12 consumer sites migrated across `@chief-clancy/dev` (6 source: `rework.ts`, `github.ts`, `azdo.ts`, `gitlab.ts`, `bitbucket/server.ts`, `bitbucket/cloud.ts`; 6 test files). An internal `ReviewCheckResult.changesRequested` in `github.ts` (mirrors the GitHub API's `CHANGES_REQUESTED` state) was renamed alongside for local consistency.

  Paired with the `PingResult` tagged-union change — both land on the same `core@2.0.0` major release (batched via changesets).

- Updated dependencies [[`a26dcd8`](https://github.com/Pushedskydiver/chief-clancy/commit/a26dcd8fe4adbed17c5b204b4e0646014d644e18)]:
  - @chief-clancy/core@3.0.0

## 0.5.6

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

## 0.5.5

### Patch Changes

- [#342](https://github.com/Pushedskydiver/chief-clancy/pull/342) [`e7fc21e`](https://github.com/Pushedskydiver/chief-clancy/commit/e7fc21e86d38066091ed04e2a4825b5cbefca2ce) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add missing TSDoc to public-API symbols that were thin on semantics per CONVENTIONS.md §Code Style. `Cached.store` and `CachedMap.store` in `core/src/shared/cache.ts` — document overwrite semantics. `Board.validateInputs` in `core/src/types/board.ts` — clarify that validation is optional and document the error-message-or-undefined return shape. `runReadinessGate` in `dev/src/execute/readiness/readiness-gate.ts` — document green-immediate, red-immediate, yellow-retry behaviour and the subagent-override. `InstallPaths` + `RunInstallOptions` in `terminal/src/installer/install/install.ts` — cross-link to `resolveInstallPaths` for the canonical path shape and document `nonInteractive`/`now` semantics.

- Updated dependencies [[`e7fc21e`](https://github.com/Pushedskydiver/chief-clancy/commit/e7fc21e86d38066091ed04e2a4825b5cbefca2ce)]:
  - @chief-clancy/core@1.0.3

## 0.5.4

### Patch Changes

- [#340](https://github.com/Pushedskydiver/chief-clancy/pull/340) [`b0b3d81`](https://github.com/Pushedskydiver/chief-clancy/commit/b0b3d81595590e137354decdcb883085233960ee) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Remove TSDoc blocks that restate signatures, per CONVENTIONS.md §Code Style "Delete TSDoc that restates the signature." Surgical preservation where the prose adds genuine semantics (e.g. "Creates the `.clancy` directory if needed", "Bold+blue for contrast on dark backgrounds"). No behaviour change; internal type inference unaffected. Covers `core/src/schemas/env.ts`, `core/src/types/board.ts`, `core/src/types/remote.ts`, `dev/src/lifecycle/lock.ts`, `dev/src/lifecycle/rework/rework.ts`, `dev/src/lifecycle/cost/cost.ts`, `dev/src/lifecycle/quality/quality.ts`, `terminal/src/shared/ansi.ts`, `terminal/src/runner/autopilot.ts`.

- Updated dependencies [[`b0b3d81`](https://github.com/Pushedskydiver/chief-clancy/commit/b0b3d81595590e137354decdcb883085233960ee)]:
  - @chief-clancy/core@1.0.2

## 0.5.3

### Patch Changes

- [#338](https://github.com/Pushedskydiver/chief-clancy/pull/338) [`061b473`](https://github.com/Pushedskydiver/chief-clancy/commit/061b473c41456ab013046efa15fecf9ddcecd208) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Extract four compound boolean conditions into named constants per CONVENTIONS.md §Code Style "Name compound boolean conditions". `shouldBranchFromEpic` helper in `branch-setup.ts` replaces two duplicate uses of `hasParent && !skipEpicBranch`. Named `const`s replace inline three-part `instanceof`/`'code' in err` checks in `session-report.ts` (ENOENT) and `lock.ts` (EPERM), and the 4-part hours/minutes range check in `queue.ts`.

## 0.5.2

### Patch Changes

- [#336](https://github.com/Pushedskydiver/chief-clancy/pull/336) [`4ebae37`](https://github.com/Pushedskydiver/chief-clancy/commit/4ebae3700d7aede540410a4b592b289064add443) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Conventions compliance sweep — naming fixes (Rules 9, 13, 8).
  Rename 3 internal `try*` functions per verb vocabulary, add boolean
  prefixes to 5 internal type fields, and remove 8 section dividers
  from touched files.

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
