# Monorepo Progress

## Session 35 Handoff

**Phase 10 complete.** 7 PRs this session: 10.2–10.7 (10.8 was already wired). 584 terminal tests, 1566 core tests (was 443 + 1566 after session 34's 10.1).

### What was done

- **10.2** (#102): Hook build infrastructure — esbuild CJS config, shared utilities, 8 entry stubs. Also: clean dist before build (`rm -rf dist tsconfig.build.tsbuildinfo`), exclude `test-helpers.ts` from core build, esbuild intermediate cleanup.
- **10.3** (#103): PreToolUse guards — credential-guard (15 patterns, `assignment()` builder, `extractContent`) + branch-guard (7 check functions, string splitting for ReDoS fix, `gitPushSegment`). Property-based tests for both.
- **10.4** (#104): Simple hooks — post-compact (context restoration from lock file) + drift-detector (version comparison with atomic session debounce via `{ flag: 'wx' }`).

### Patterns established this session

- Hook entry points are thin wiring: read input → call pure logic → output JSON. All I/O at the boundary.
- `assignment()` builder for DRYing credential regex patterns.
- String splitting over dynamic regex for branch matching (ReDoS-safe).
- Atomic debounce via `writeFileSync` with `{ flag: 'wx' }` — no TOCTOU.
- Test credential values constructed at runtime (`fakeKey()`) to avoid triggering the live credential-guard hook.
- `isPlainObject` from shared types replaces inline `typeof`+`null`+`Array.isArray` checks.

### Build hygiene fixes (included in 10.2)

- Both packages now clean `dist/` and `tsconfig.build.tsbuildinfo` before building.
- Core's `test-helpers.ts` excluded from build tsconfig (was leaking vitest into published dist).
- esbuild script cleans up tsc intermediates after bundling — only flat CJS files remain in `dist/hooks/`.

### Phase 10 Audit

6 audit agents ran in parallel (conventions, test coverage, entry points, security, build, behavioral parity). 8 regressions, 3 bugs, 12 convention violations, 10+ test gaps found. 6 cleanup PRs planned (C31–C36).

#### Cleanup PRs

| PR  | Theme                          | Scope                                                                                                                            |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| C31 | Notification regressions       | AppleScript double-quote escaping, `-NoProfile`, `windowsHide`, `[Clancy]` prefix, `hookSpecificOutput.message` check            |
| C32 | Post-compact + branch-guard    | `ticketTitle` default `'Unknown'`, empty `parentKey` guard, actionable error messages                                            |
| C33 | NaN guard + TOCTOU removal     | `parseBridgeMetrics` `Number.isFinite` check, remove `existsSync` in `findInstallDir`/`countStaleBriefs`, catch block comments   |
| C34 | Cast/assertion comments + JSDoc | All 8 `as` cast comments, `!` assertion comment, stale line count, missing `@param` tags                                        |
| C35 | Test gaps — high priority      | NaN metrics, boundary values (36%/26%/80%/100%), empty parentKey/title, brief date boundary, escape verification, mixed briefs   |
| C36 | Test gaps — lower priority     | stdin wrong-shape JSON, `isPlainObject` with class instances, empty session IDs, interaction tests (parse→guard pipeline)         |

### Next up

- **C31**: Notification regressions — first cleanup PR.

## Session 34 Handoff

**Phase 9 cleanup complete + Phase 10 started.** 7 PRs this session: C25–C30 + 10.1. 353 terminal tests, 1566 core tests (was 322 + 1562).

### What was done

- **C25** (#95): Extract shared types — consolidated `SpawnSyncFn` (4x), `ConsoleLike` (2x), `AppendFn` (inline) into `runner/shared/types.ts`. Narrowed `stdio` from `(string | number)[]` to `StdioValue` union. Updated 6 consuming files. DA review: 0 HIGH, 0 MEDIUM, 3 LOW — all acceptable.
- **C26** (#96): Non-null assertion comments — added `// Safe: ...` comments to 10 `!` assertions explaining pipeline ordering guarantees. Replaced `e.parent!` with `hasParent` type predicate (eliminates assertion entirely). DA review: 0 HIGH, 1 MEDIUM (invoke-phase assertions missed — fixed), 2 LOW.
- **C27** (#97): Test gaps — `invoke-phase.test.ts` (5 tests: fresh/rework branching, TDD flag, ok/fail, prFeedback default) + `deliver-phase.test.ts` (7 tests: wiring, appendProgress, recordDelivery/recordRework, postReworkActions with/without handlers). DA review: 1 HIGH (mock reset — fixed), 3 MEDIUM (missing assertions — fixed).
- **C28** (#98): Error handling hardening — narrowed `safeRead` catch to ENOENT only (M1). Added `console.error` to silent `buildSessionReport` write catch with `ConsoleLike` on `BuildReportOpts` (M2). NaN guard in `parseTokenCount` (M4). Added `console.error` to silent autopilot webhook catch (M5). Added `'session complete'` fallback in `extractSummaryForWebhook` (L9). DA review: 0 findings.
- **C29** (#99): Property-based tests + edge cases — fast-check for `parseCostsLog`, `progressTimestampToMs`, `buildPrompt`, `buildReworkPrompt`. Edge cases for `checkStopCondition` (undefined phase/error), `isSlackWebhook` subdomain, `getQuietSleepMs` sub-minute precision, CRLF, comma tokens, `buildSessionReport` mkdir failure. DA review: 2 MEDIUM (weak properties — fixed).
- **C30** (#100): Minor cleanup — `\r\n`-safe split in `extractSummaryForWebhook` (M6). `ReadonlyMap` return from `makeFindCompletedEpics` (L3). `TDD_BLOCK` constant rename (L4). Injected `warn` callback in `notify.ts` (L5). `MAX_ITERATIONS_CAP` on `iterations()` (L10). Export-for-testability documented in CONVENTIONS.md (L12). Dep-factory behavioral test (M8). DA review: 2 MEDIUM (negative iterations + missing `\r\n` test — fixed).

### Phase 10 Plan — Terminal Hooks

8 hooks + 1 agent hook. Old hooks are plain JS with convention violations (functions >50 lines, no types, no tests). Each must be rewritten to meet standards: TypeScript source, <50 line functions, named booleans, DI for testability, co-located tests, compiled to CommonJS via esbuild.

**Existing infrastructure:** Hook installer is complete and tested. Expects 8 compiled `.js` files. All hook event registrations already mapped. Verification gate agent prompt already exists at `terminal/src/agents/verification-gate.md`.

**Key constraint:** Hooks must be CommonJS after compilation (esbuild bundles), zero npm dependencies, best-effort/fail-open.

#### PRs

| PR   | Theme                       | Scope                                                                                                                                                             |
| ---- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10.1 | Wire `retryEntry` stub      | Complete PR retry wiring in `dep-factory.ts` — delegate to `deliverViaPullRequest` + `resolvePlatformHandlers`. Closes last Phase 9 gap.                          |
| 10.2 | Hook build infrastructure   | esbuild CJS config, `src/hooks/` dir, shared utilities (stdin reader, lock file parser, tmpdir helpers). Foundation for all hooks.                                |
| 10.3 | PreToolUse guards           | credential-guard (extract `extractContent` + `scanForCredentials`), branch-guard (decompose 66-line `checkCommand` into 6 check functions, immutable init).       |
| 10.4 | Simple hooks                | post-compact (54 lines, minimal changes), drift-detector (97 lines, session debounce). Both low complexity.                                                       |
| 10.5 | Context monitor             | Complex (190 lines, complexity 16). Decompose into `runContextGuard`, `runTimeGuard`, `shouldFireWarning` pure functions + debounce state machine. Standalone PR. |
| 10.6 | Statusline                  | Writes bridge file for context-monitor. Extract duplicate `normalizeContextUsage` logic. ANSI context bar builder.                                                |
| 10.7 | Notification + check-update | notification (platform dispatch: macOS/Linux/Windows). check-update (split internal modules: version check + brief staleness).                                    |
| 10.8 | Verification gate           | Wire existing agent prompt into hook installer. Minimal code — registration config only.                                                                          |

#### Hook complexity summary

| Hook             | Old lines | Complexity | Key refactoring needed                                                     |
| ---------------- | --------- | ---------- | -------------------------------------------------------------------------- |
| credential-guard | 121       | Low (4)    | Extract content extraction + scan functions. Narrow regex false positives. |
| branch-guard     | 128       | Medium (8) | Split `checkCommand` into 6 functions. Immutable `PROTECTED_BRANCHES`.     |
| post-compact     | 54        | Low (3)    | Minimal — add JSDoc, share lock file reader.                               |
| drift-detector   | 97        | Low (4)    | Minimal — session debounce via tmpdir.                                     |
| context-monitor  | 190       | High (16)  | Heavy decomposition. Dual debounce, 145-line callback, nesting depth 4.    |
| statusline       | 83        | Medium     | Duplicate normalisation logic. Bridge file for context-monitor.            |
| notification     | 106       | Low-Med    | Platform dispatch (3 OS). Already exports testable functions.              |
| check-update     | 115       | Medium     | Two responsibilities (npm version + brief staleness). Detached spawn.      |

- **10.1** (#101): Wire `retryEntry` stub — replaced `async () => undefined` in dep-factory with `makeRetryEntry` that delegates to `attemptPrCreation`. Recomputes branches via `computeTicketBranch`/`computeTargetBranch`, builds PR title/body. Added `ticketType` to progress format (`type:VALUE` suffix) so retried PRs get correct commit type. New core barrel exports: `attemptPrCreation`, `resolveCommitType`, `buildPrBody`. DA review: 1 HIGH (resolved by adding ticketType), 5 MEDIUM (all addressed).

- **10.2** (#102): Hook build infrastructure — esbuild CJS config (`src/hooks/esbuild.hooks.ts`), 4 shared utility modules (hook-output, tmpdir, lock-file, stdin-reader), 8 entry point stubs, `isPlainObject` type guard. Build pipeline: `tsc → tsc-alias → node dist/hooks/esbuild.hooks.js`. Fixed ESLint `**/hooks/` global ignore that would have blocked linting of `src/hooks/`. Added knip entry points for standalone hook bundles. Cross-platform stdin (fd 0 instead of `/dev/stdin`). DA review: 3 MEDIUM (TOCTOU race — fixed by removing `existsSync`, `/dev/stdin` — fixed with fd 0, unjustified `as` casts — fixed with comments + `isPlainObject`), 5 LOW (all addressed). 381 terminal tests (+28).

- **10.3** (#103): PreToolUse guards — credential-guard (`scan-credentials.ts`: 15 regex patterns with `assignment()` builder, `extractContent`, `isAllowedPath`, `extractNewString`) and branch-guard (`check-command.ts`: 7 decomposed check functions with named regex/message constants, `buildProtectedBranches`, `gitPushSegment`). Replaced dynamic regex in protected-branch check with string splitting (ReDoS fix). Removed `process.env` read from pure `checkCommand` — entry point passes branches. Property-based tests for both scanners. DA review: 4 MEDIUM (process.env in pure fn — fixed, property-based tests — added, ReDoS — fixed with string splitting, property tests for checkCommand — added), 5 LOW (cast comments — added, suffix matching — acceptable, restore --staged — tested as intentionally allowed, -f false positive — fixed with `gitPushSegment`, extractNewString — extracted). 443 terminal tests (+62).

- **10.4** (#104): Simple hooks — post-compact (`build-context.ts`: builds context restoration from lock file, immutable line assembly) and drift-detector (`detect-drift.ts`: `versionsDiffer`, `readInstalledVersion`, `readPackageVersion`, `buildDriftWarning` with DI). Unified `COMMANDS_VERSION` constant (was duplicate `LOCAL_VERSION`/`GLOBAL_VERSION`). Atomic session debounce via `writeFileSync` with `{ flag: 'wx' }` (no TOCTOU). DA review: 3 MEDIUM (duplicate constant — unified, TOCTOU — fixed with exclusive create, test stubs don't verify paths — fixed), 4 LOW (all addressed with edge-case tests). 468 terminal tests (+25).

- **10.5** (#105): Context monitor — decomposed 190-line JS hook (complexity 16) into pure functions with independent debounce state machines. `runContextGuard` (warning 35% / critical 25%), `runTimeGuard` (warning 80% / critical 100% of `CLANCY_TIME_LIMIT`), `shouldFireWarning` (shared debounce: first breach, every 5th, or escalation). `parseBridgeMetrics`, `parseDebounceState`, `resolveTimeLimit` (NaN-safe). Entry point: async stdin → guards → persist → emit. DA review: 1 HIGH (NaN passthrough in `resolveTimeLimit` — fixed with `Number.isNaN` guard), 2 MEDIUM (entry-point helpers untested — moved `resolveTimeLimit` to testable module; `as` cast replaced with type predicate), 2 LOW (return type annotation, staleness boundary consistent). 512 terminal tests (+44).

- **10.6** (#106): Statusline — rewrote 83-line JS hook. `normalizeContextUsage` (auto-compact buffer rescaling, was duplicated in old hook), `buildBridgeData`, `buildContextBar` (4-tier ANSI colour thresholds with bar width clamping), `checkUpdateAvailable` (strict boolean, DI reader), `resolveCachePath` (DI for env + homedir), `buildStatusline` (declarative composition). DA review: 2 HIGH (resolveCachePath DI — moved to testable module; handleEvent untested — all logic in testable module), 1 MEDIUM (bar width clamping — added), 1 LOW (remaining=0 — tested). 542 terminal tests (+30).

- **10.7** (#107): Notification + check-update. Notification: `extractMessage` (multi-shape cascade), `sendNotification` (platform dispatch: macOS/Linux/Windows with DI), `escapeAppleScript`/`escapePowerShell`, `CLANCY_DESKTOP_NOTIFY=false` suppression. Check-update: `findInstallDir` (local/global), `readInstalledVersion`, `fetchLatestVersion`, `buildUpdateCache`, `parseBriefDate`, `countStaleBriefs` (functional filter via `isStaleBrief`), detached spawn for non-blocking npm check. DA review: 1 HIGH (Windows MessageBox is blocking modal — documented as known limitation), 3 MEDIUM (stale JSDoc — fixed, no semver — documented, child script duplication — cross-referenced), 2 LOW (cascade tests — added). 584 terminal tests (+42).

- **10.8**: Verification gate — no new code needed. Agent prompt (`verification-gate.md`) and installer wiring (`buildDesiredHooks` Stop hook registration with 120s timeout) were already implemented and tested in earlier phases.

## Session 33 Handoff

**Phase 9 complete.** 4 PRs this session: 9.5 (implement entry point), 9.6 (session report), 9.7 (autopilot runner), plus the once→implement rename. Phase 9 audit done — 6 cleanup PRs planned (C25–C30).

### What was done

- **9.5** (#92): Implement entry point — `runImplement` thin orchestration layer. Creates `RunContext`, wires `PipelineDeps` via `buildPipelineDeps`, runs pipeline, displays structured result. All I/O injected (exec, fs, spawn, fetch, console, clock, runPipeline). Switch exhaustive via `default: never`. Also: dep-factory barrel, red/yellow ANSI exports, terminal barrel runner exports. Renamed from `once` → `implement` mid-PR per Alex's request (`/clancy:implement`). 14 tests. DA review: 1 HIGH + 2 MEDIUM + 2 LOW — all fixed.
- **9.6** (#93): Session report generator — pure-function architecture. `parseCostsLog` (string parser), `progressTimestampToMs` (timestamp converter), `generateSessionReport` (markdown builder with summary/tickets/next-steps/quality sections), `buildSessionReport` (orchestrator with DI). Functional style (no mutation, no reduce, `\r\n` support). Core barrel: added `parseProgressFile`, `formatTimestamp`, `getQualityData` exports. 18 tests. DA review: 3 MEDIUM — all fixed. Multiple readability refactors per Alex's feedback (named booleans, extracted helpers, `optionalLine` DRY pattern, `attachCost` from map callback, `QualitySummary` type extraction).
- **9.7** (#94): Autopilot runner — `runAutopilot` loop orchestrator. `parseTime` (HH:MM parser), `getQuietSleepMs` (same-day + overnight window support), `checkStopCondition` (discriminated union, exhaustive switch, fatal vs non-fatal abort phases using `PipelineResult` not stdout parsing). All I/O injected. One approved eslint-disable for `functional/no-loop-statements`. 34 tests including fast-check property tests. DA review: 3 MEDIUM + 3 LOW — all fixed. Named boolean refactors per Alex's feedback.
- **Naming decision:** `once` → `implement` (`/clancy:implement`), `afk` → `autopilot` (`/clancy:autopilot`). Documented in memory + PROGRESS.md.

### Phase 9 final stats

- **Track A** (board parity): 6 PRs (9.0a–f) — all 6 boards in planner + strategist workflows
- **Track B** (orchestrator): 7 PRs (9.1–9.7) — CLI bridge, prompt builder, webhooks, dep factory, implement, session report, autopilot
- **Terminal tests:** 322 (was 185 at Phase 8 end, +137 from Phase 9)

### Phase 9 Audit — Cleanup Plan

4-agent sweep (type safety, test coverage, conventions, security/errors) across all 9 source files + 7 test files. **6 HIGH, 10 MEDIUM, 12 LOW** findings (deduplicated).

#### HIGH findings

| ID  | Finding                                                                | Affected files                                   |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------ |
| H1  | `SpawnSyncFn` duplicated 4x                                            | cli-bridge, dep-factory, invoke-phase, implement |
| H2  | `ConsoleLike` duplicated 2x                                            | implement, autopilot                             |
| H3  | 11 non-null assertions (`!`) without safety comments                   | dep-factory, invoke-phase, deliver-phase         |
| H4  | `SpawnSyncFn.stdio` type too wide — accepts any `(string \| number)[]` | cli-bridge (propagates to all copies)            |
| H5  | `deliver-phase.ts` — exported function, zero tests                     | deliver-phase                                    |
| H6  | `invoke-phase.ts` — exported function, zero tests                      | invoke-phase                                     |

#### MEDIUM findings

| ID  | Finding                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------ |
| M1  | `safeRead` swallows all errors (EACCES, EPERM) — should only swallow ENOENT                                        |
| M2  | Session report write catch silently swallows all errors — should warn                                              |
| M3  | `sumTokens` unbounded recursion — stack overflow on large cost logs                                                |
| M4  | `parseTokenCount` NaN propagation on malformed `~,` input                                                          |
| M5  | Autopilot webhook catch completely silent — should warn                                                            |
| M6  | `extractSummaryForWebhook` `.split('\n')` not `\r\n`-safe                                                          |
| M7  | Parsers missing property-based tests: `parseCostsLog`, `progressTimestampToMs`, `buildPrompt`, `buildReworkPrompt` |
| M8  | `dep-factory.test.ts` assertions all `typeof` checks — no behavioral wiring tests                                  |
| M9  | `checkStopCondition` missing edge cases: `phase: undefined`, `error: undefined`                                    |
| M10 | `isSlackWebhook` subdomain branch untested                                                                         |

#### LOW findings

| ID  | Finding                                                                    |
| --- | -------------------------------------------------------------------------- |
| L1  | `AppendFn` type duplicated inline in deliver-phase.ts                      |
| L2  | `deliverFs` adapter missing `readonly` on method                           |
| L3  | `makeFindCompletedEpics` returns mutable `Map` (should be `ReadonlyMap`)   |
| L4  | `tddBlock` constant not UPPER_SNAKE_CASE                                   |
| L5  | `notify.ts` hard-codes `console.warn` instead of injecting logger          |
| L6  | `getQuietSleepMs` sub-minute precision untested                            |
| L7  | `parseCostsLog` `\r\n` line endings untested                               |
| L8  | Comma-formatted tokens (`~1,200,000`) untested                             |
| L9  | `extractSummaryForWebhook` no fallback for empty summary                   |
| L10 | `iterations` array — no cap on `maxIterations`                             |
| L11 | `buildSessionReport` missing tests: `readCostsFile` throws, `mkdir` throws |
| L12 | Export-for-testability stance undocumented                                 |

#### Cleanup PRs (C25–C30)

| PR  | Theme                                   | Fixes                   | Scope                                                                                                                                             |
| --- | --------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| C25 | Extract shared types                    | H1, H2, H4, L1          | Create `runner/shared/types.ts` with `SpawnSyncFn` (narrowed stdio), `ConsoleLike`, `AppendFn`. Update 6 files. **Done**                          |
| C26 | Non-null assertion comments             | H3                      | Add `// Safe: ...` comments to all 10 `!` assertions. Type predicate `hasParent` eliminates 1 assertion. **Done**                                 |
| C27 | Test gaps: deliver-phase + invoke-phase | H5, H6                  | `invoke-phase.test.ts` (5 tests) + `deliver-phase.test.ts` (7 tests). Wiring, branching, handler dispatch. **Done**                               |
| C28 | Error handling hardening                | M1–M5, L9               | Narrow catches to ENOENT. Add `console.error` to silent catches. NaN guard in `parseTokenCount`. Webhook fallback. **Done**                       |
| C29 | Property-based tests + edge cases       | M7, M9, M10, L6–L8, L11 | Fast-check for parsers/prompt builders. Edge cases for stop conditions, subdomain, sub-minute, `\r\n`, commas, error paths. **Done**              |
| C30 | Minor cleanup                           | M6, M8, L2–L5, L10, L12 | `ReadonlyMap`, `TDD_BLOCK`, `\r\n` in webhook extract, inject warn, dep-factory behavioral test, `maxIterations` cap, export convention. **Done** |

### Process notes

- DA review on every PR — caught real issues in all 3 PRs.
- Alex directed naming decisions mid-session (once→implement, afk→autopilot) — applied cleanly since no downstream consumers yet.
- Multiple readability refactors per Alex's live feedback: named booleans, extracted helpers, broken chains, expanded ternaries. These are now established patterns for the codebase.
- Approved one `eslint-disable` for `functional/no-loop-statements` in autopilot (sequential async with early return).

### Next up

- **C25–C30**: Phase 9 cleanup PRs (6 PRs). One at a time, merge each before next. DA review + self-review on every PR.
- After cleanup: evaluate Phase 10 scope (esbuild bundles? slash command scripts? integration tests?).

## Session 32 Handoff

**Track B continues.** 3 PRs this session: 9.2 (prompt builder), 9.3 (webhooks), 9.4 (dep factory).

### What was done

- **9.2** (#89): Prompt builder — three pure functions for constructing Claude CLI prompts. `ticketLabel` (provider-specific labels for all 6 boards), `buildPrompt` (full implementation prompt with executability check, TDD block, blocker handling), `buildReworkPrompt` (reviewer feedback prompt with numbered comments, previous context). Both switches (`ticketLabel`, `parentLabel`) are exhaustive over `BoardProvider`. No DI needed — pure string builders. 30 tests. 231 terminal tests total. DA review caught 2 MEDIUM (exhaustive `parentLabel` switch, field ordering) + 4 LOW (misleading test values, test gaps) — all fixed.
- **9.3** (#90): Webhook notifications — `isSlackWebhook` (hostname-based URL detection, fixed CodeQL substring sanitization finding), `buildSlackPayload`, `buildTeamsPayload`, `sendNotification` (DI for fetch, auto-detects Slack vs Teams, best-effort). 19 tests including property-based tests via fast-check. DA review caught 2 MEDIUM + 2 LOW — all fixed.
- **9.4** (#91): Dep factory — `buildPipelineDeps(opts)` wiring all 15 `PipelineDeps` fields from shared I/O resources (exec, lockFs, progressFs, costFs, envFs, qualityFs, spawn, fetch). Decomposed into `wireEarlyPhases`, `wireTicketPhases`, `wireGitAndInvoke`, `wireDeliver`, `wireFinalization` to stay under 50-line function limit. Invoke phase extracted to `invoke-phase.ts`, deliver phase to `deliver-phase.ts`. Also added: 13 phase barrel index.ts files + phases aggregate barrel, core barrel exports for phase functions + shared utilities, terminal runner barrels for cli-bridge/prompt-builder/notify. Refactored phase `AppendFn` types to use `ProgressStatus` instead of `string` (removed `as` cast). 6 tests. 256 terminal tests total. DA review caught 4 MEDIUM + 5 LOW — all fixed.

### Process notes

- DA review on every PR without exception — all findings addressed including LOW severity.
- CodeQL caught incomplete URL substring sanitization in `isSlackWebhook` — fixed with hostname-based URL parsing.
- Phase `AppendFn` types now use `ProgressStatus` instead of `string` — type safety enforced at the phase boundary, no casts in dep factory.

### Next up

- **9.5**: Implement entry point (depends on 9.4) — parse args, create context, run pipeline, display result
- **9.6**: Session report generator (independent) — parse costs.log + progress.txt
- Then 9.7 (autopilot runner, depends on 9.5 + 9.6 + 9.3)

## Session 31 Handoff

**Track A complete, Track B started.** 3 PRs this session: 9.0e-9.0f (board parity finished) + 9.1 (first TypeScript in Phase 9).

### What was done

- **9.0e** (#86): Shortcut added to strategist workflows (brief.md + approve-brief.md). DA review caught 3 findings (missing timeout table entry, wrong verb name, missing interactive hint) — all fixed.
- **9.0f** (#87): Notion added to strategist workflows with documented API limitations (rich_text not markdown, 2000-char limit, no comment editing, blocks not description, relation properties for hierarchy). DA review caught 1 HIGH (missing Notion in AFK error message) — fixed.
- **Track A complete:** All 6 boards (GitHub, Jira, Linear, Azure DevOps, Shortcut, Notion) now have dispatch blocks in both planner and strategist workflows.
- **9.1** (#88): Claude CLI bridge — first TypeScript in Phase 9 Track B. Two functions: `invokeClaudePrint` (single-prompt mode, captures stdout) and `invokeClaudeSession` (interactive, streams to terminal). `spawnSync` injected via DI. 16 tests. 201 terminal tests total. DA review caught 3 MEDIUM (type safety) — all fixed.

### Process notes

- Barrel `index.ts` deferred for new leaf modules until the consuming PR (knip flags unused files). CLI bridge barrel will be added in 9.4 (dep factory).
- DA review on every PR without exception — caught real issues in all 3 PRs this session.

### Next up

- **9.2**: Prompt builder (`buildPrompt`, `buildReworkPrompt`, `ticketLabel`)
- **9.3**: Webhook notifications (`sendNotification`, Slack/Teams payload builders)
- **9.6**: Session report generator (parse costs.log + progress.txt)
- Then 9.4 (dep factory, depends on 9.1+9.2+9.3) → 9.5 (once entry) → 9.7 (AFK runner)

## Session 30 Handoff

**Phase 9 validated and Track A (board parity) in progress.** 7 PRs merged this session: C22-C24 (Phase 2 Cleanup complete) + 9.0a-9.0d (4 of 6 board parity PRs).

### What was done

- **Phase 2 Cleanup complete:** C22 (#79), C23 (#80), C24 (#81) merged. 185 terminal tests. All audit findings resolved.
- **Phase 9 validated:** 4-agent sweep of original brief. Key changes: removed PR 9.4 (ANSI already done), split 9.5 (dep factory + entry point), split 9.6 (session report + AFK runner), added Track A (board parity), deferred desktop notifications.
- **9.0a** (#82): Azure DevOps added to planner workflows (plan.md + approve-plan.md). Also fixed pre-existing feedback filtering bug — changed from author-based to content-based filtering in plan.md and brief.md (Clancy posts as the user, so author filtering excluded the user's own feedback).
- **9.0b** (#83): Shortcut added to planner workflows.
- **9.0c** (#84): Notion added to planner workflows with documented API limitations (no comment editing, 2000-char rich_text limit, blocks API for description).
- **9.0d** (#85): Azure DevOps added to strategist workflows (brief.md + approve-brief.md, 21 dispatch blocks). DA review caught 7 MEDIUM findings — all fixed. Also included retroactive DA fixes for planner (dependency detection table, board-specific key format errors).

### Process notes

- DA review must never be skipped, even for markdown PRs. PRs 9.0a-c were merged without DA review; retroactive review caught dependency detection table gaps and board-specific error message issues that required fixes in 9.0d.
- Content-based comment filtering (not author-based) is the correct pattern across all workflows — Clancy posts using the user's own credentials.

### Next up

- **9.0e**: Add Shortcut to strategist workflows (brief.md + approve-brief.md)
- **9.0f**: Add Notion to strategist workflows (brief.md + approve-brief.md)
- Then Track B: 9.1 (Claude CLI bridge) → 9.2 (prompt builder) → 9.3 (webhooks) → 9.4 (dep factory) → 9.5 (once entry) → 9.6 (session report) → 9.7 (AFK runner)

## Session 29 Handoff

**Phase 2 Cleanup complete.** All 5 cleanup PRs (C20–C24) merged. 185 terminal tests.

### What was done

- **C22** (#79): Test coverage gaps — non-ENOENT re-throw tests for readManifest (H4), safeFileHash (H5), safeCopy (M8), safeUnlink (M9). installHooks failure warning test (H6). confirmOverwrite edge cases (M10). ISO meta.date assertion (L11). parseManifestJson array input (L12).
- **C23** (#80): Comment hygiene + export cleanup — removed over-exported `fileHash`, `red`, `yellow`, `CORE_PACKAGE_NAME` from barrel (M13). Exported `HOOK_FILES` for test import (L15, L7). Added `@returns` JSDoc to 7 functions (L8). Broke 4-method chain in `parseEnabledRoles` (L9). Changed `replaceAll` → `replace` for WORKFLOW_REF regex (L1).
- **C24** (#81): Improved hook-installer blanket catch — logs error message before returning false (H1). Made `cleanDisabledFiles` recursive with `rmSync` (M6).

### Audit status

All 6 HIGH, 13 MEDIUM, and non-deferred LOW findings resolved across C20–C24. Deferred items (M11, L2–L6, L13–L14, L16) documented in Phase 2 Cleanup section below.

## Session 28 Handoff

**PRs merged:** C20 (#77), C21 (#78)

## Phase 1: Scaffold

| PR   | Description                                                                                 | Status |
| ---- | ------------------------------------------------------------------------------------------- | ------ |
| 1.1  | Repo init: pnpm, workspace, root package.json, .gitignore, .editorconfig, LICENSE, README   | Done   |
| 1.2  | Foundation docs: CLAUDE.md, CONVENTIONS.md, DEVELOPMENT.md, GIT.md, GLOSSARY.md, decisions/ | Done   |
| 1.3  | TypeScript: root tsconfig, per-package tsconfig, hello-world index.ts                       | Done   |
| 1.4  | ESLint: root eslint.config.ts with all rules                                                | Done   |
| 1.5  | Prettier: .prettierrc with import sort plugin                                               | Done   |
| 1.6  | Vitest: root workspace config, per-package config, trivial tests                            | Done   |
| 1.7  | Turborepo: turbo.json with build/test/lint/typecheck tasks                                  | Done   |
| 1.8  | CI: GitHub Actions workflow, branch protection                                              | Done   |
| 1.9  | Quality tooling: knip, publint, attw                                                        | Done   |
| 1.10 | Changesets: config, independent versioning                                                  | Done   |

## Phase 2: Terminal — Installer

Adjusted after phase validation (2026-03-23). Reordered to build leaves first, split orchestrator from integration test, added prerequisites. See validation notes below.

| PR  | Description                                                                   | Status |
| --- | ----------------------------------------------------------------------------- | ------ |
| 2.0 | Prerequisites: `terminal/src/shared/ansi/` + `core/src/shared/env-parser/`    | Done   |
| 2.1 | File operations: `file-ops/` — fileHash, copyDir, inlineWorkflows             | Done   |
| 2.2 | Prompts + UI: `prompts/` (DI readline) + `ui/` (banner, success)              | Done   |
| 2.3 | Manifest: `manifest/` — buildManifest, detectModified, backup (immutable)     | Done   |
| 2.4 | Hook installer: `hook-installer/` — register hooks immutably in settings.json | Done   |
| 2.5 | Role filter: `role-filter/` — determineRoles, copyRoleFiles, cleanDisabled    | Done   |
| 2.6 | Orchestrator: `install.ts` — decomposed main(), runInstall(config) pipeline   | Done   |
| 2.7 | Integration test: E2E against temp directory, fresh + update paths            | Done   |

### Dependencies

- 2.1, 2.2, 2.4 can run in parallel (all depend on 2.0)
- 2.3 depends on 2.1 (uses fileHash)
- 2.5 depends on 2.1 (uses copyDir)
- 2.6 depends on 2.1-2.5
- 2.7 depends on 2.6

### Phase validation notes (2026-03-23)

**Key findings from breakdown validator + DA:**

1. Original PR 2.1 was scoped as "prompts, UI, banner" but install.ts is a 376-line orchestrator — far too much for one PR. Split into prompts+UI (2.2) and orchestrator (2.6).
2. Original ordering had install.ts first, requiring stubs for all dependencies. Reversed: build leaves first.
3. `inlineWorkflows()` function in install.ts had no home and zero tests. Moved to file-ops (2.1).
4. External dependencies (ansi, env-parser) must exist before Phase 2. Added PR 2.0.
5. Manifest uses mutable walk() closure — rewrite as immutable recursive function.
6. Hook installer mutates settings object — rewrite to build immutably.
7. `printSuccess()` is 75 lines — rewrite as data-driven under 50-line limit.
8. Prompts has side effect at import (module-scoped readline) — restructure with DI.
9. install.ts main() is ~130 lines, complexity ~15, 6 let bindings — decompose into runInstall(config) pipeline.

**Rewrite assessments:**

- Carry over: file-ops (minor edits), all test files
- Simplify: prompts (DI instead of module-scoped side effect)
- Minor rewrite: manifest (immutable), role-filter (options object, split concerns)
- Major rewrite: hook-installer (immutable, decomposed), ui (data-driven), install.ts (pipeline)

## Phase 2 Cleanup

Pre-Phase 9 audit of terminal installer modules. 4-agent sweep (bugs, conventions, test coverage, architecture). Audit run 2026-03-26.

| PR  | Description                                                                                                                  | Status |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ------ |
| C20 | Shared helpers: extract `isPlainObject` + `rejectSymlink` → `shared/`, replace `isEnoent`, add barrel (H2, M1-M4, M12)       | Done   |
| C21 | TOCTOU fix + safety: wrap `resolveWorkflowRef` try/catch, `isFile()` guard in `copyEntry`, stale statusLine (H3, M5, M7)     | Done   |
| C22 | Test coverage: non-ENOENT re-throws, installHooks failure, confirmOverwrite edges, fs-errors tests (H4-H6, M8-M10, L10-L12)  | Done   |
| C23 | Comment hygiene + export cleanup: `as` cast comments, `@returns` JSDoc, remove over-exports, chain fix (M13, L1, L7-L9, L15) | Done   |
| C24 | `cleanDisabledFiles` recursive cleanup + hook-installer catch improvement (H1, M6)                                           | Done   |

### HIGH findings

1. **H1** — `hook-installer.ts:332` blanket `catch` swallows EACCES/EPERM, returns `false`. Silent failure with no root cause indication.
2. **H2** — `hook-installer.ts:170` `entry.hooks[0]` accessed without empty-array guard. Crashes on malformed entry.
3. **H3** — `file-ops.ts:100-106` TOCTOU race: `existsSync` → `rejectSymlink` → `readFileSync`. Should wrap in try/catch.
4. **H4** — `manifest.ts:119-126` `readManifest` non-ENOENT re-throw path untested. EACCES silently propagates.
5. **H5** — `manifest.ts:129-136` `safeFileHash` non-ENOENT re-throw untested. Same pattern as H4.
6. **H6** — `install.ts:372-394` `installHooks` returning `false` path untested. `printSuccess` shown even when hooks broken.

### MEDIUM findings

- **M1** — `isPlainObject` duplicated in `manifest.ts:93` and `hook-installer.ts:67`. Extract to `shared/`.
- **M2** — `rejectSymlink` duplicated in `file-ops.ts:22-32` and `hook-installer.ts:56-64`. Extract to `shared/`.
- **M3** — `manifest.ts:38-41` `isEnoent` reimplements `hasErrorCode(err, 'ENOENT')` from `shared/fs-errors.ts`.
- **M4** — `as` casts without justification comments in `file-ops.ts:26`, `manifest.ts:40`, `hook-installer.ts:219`.
- **M5** — `hook-installer.ts:253-258` `statusLine` never updated on reinstall to different path. Stale path preserved.
- **M6** — `role-filter.ts:49-55` `cleanDisabledFiles` only removes files, not subdirectories. Stale nested dirs remain.
- **M7** — `file-ops.ts:54-67` `copyEntry` doesn't check `entry.isFile()`. Symlinks/FIFOs/sockets fall through to `copyFileSync`.
- **M8** — `manifest.ts:178-186` `safeCopy` non-ENOENT re-throw untested.
- **M9** — `role-filter.ts:40-46` `safeUnlink` non-ENOENT re-throw untested.
- **M10** — `install.ts:258` `confirmOverwrite` edge cases untested (`"yes"`, `"Y"`, leading whitespace).
- **M11** — Cross-module imports bypass barrel `index.ts` files — all go direct to source file. _Deferred — cosmetic._
- **M12** — `shared/` directory has no `index.ts` barrel.
- **M13** — Over-exported symbols: `fileHash`, `red`, `yellow`, `CORE_PACKAGE_NAME` have no external consumers.

### LOW findings

- **L1** — `file-ops.ts:91` module-level regex with `g` flag (latent `lastIndex` hazard).
- **L2** — `prompts.ts:52-59` `choose` returns raw input, not validated option. _Deferred — caller responsibility._
- **L3** — `hook-installer.ts:102` agent prompt fingerprint uses only first 100 chars. _Deferred — acceptable heuristic._
- **L4** — `hook-installer.ts:219` `isHookEntry` only checks `hooks` is array, not contents. _Deferred — mitigated downstream._
- **L5** — `ansi.ts` no `NO_COLOR`/`FORCE_COLOR` env var support. _Deferred — cosmetic._
- **L6** — `install.ts:431` global mode hardcodes `enabledRoles: null`. _Deferred — intentional design._
- **L7** — Hardcoded count "8" in `hook-installer.test.ts:15` comment.
- **L8** — Missing `@returns` JSDoc on 7 exported functions across file-ops, role-filter, ui, install.
- **L9** — `install.ts:171-174` 4-method chain in `parseEnabledRoles`.
- **L10** — `fs-errors.ts` has no unit tests.
- **L11** — `manifest.test.ts:212` weak `toBeDefined()` assertion on `meta.date`.
- **L12** — `manifest.ts:108-116` valid JSON with wrong shape (array) untested.
- **L13** — Missing integration test: permission error during install. _Deferred — high-effort._
- **L14** — Missing integration test: concurrent installs. _Deferred — high-effort._
- **L15** — `HOOK_FILES` duplicated in test instead of imported.
- **L16** — `install.ts` at 444 lines — above 300-line convention limit. _Deferred — manageable._

### Deferred

- M11: Barrel bypass imports — cosmetic, defer unless barrel convention is formalised
- L2-L6: Design-level or cosmetic items — document rather than change
- L13-L14: Integration test scenarios — high-effort, low-probability edge cases
- L16: `install.ts` length — manageable with extracted helpers, defer unless code changes

## Phase 3: Terminal — Roles & Agents

| PR  | Description                                                                                      | Status |
| --- | ------------------------------------------------------------------------------------------------ | ------ |
| 3.1 | Role markdown files: 5 roles (35 `.md` files), reviewed for clarity/accuracy, Prettier-formatted | Done   |
| 3.2 | Agent prompts: 7 agent `.md` files, reviewed for clarity and path references                     | Done   |
| 3.3 | Templates: `CLAUDE.md` template, updated references for monorepo context                         | Done   |

## Phase 4: Core — Types & Schemas

Adjusted after phase validation (2026-03-24). Split `detectBoard()` into separate PR, split board API schemas into 2 batches, added prerequisites PR.

| PR   | Description                                                                                      | Status |
| ---- | ------------------------------------------------------------------------------------------------ | ------ |
| 4.0  | Prerequisites: add `zod` dependency to core                                                      | Done   |
| 4.1  | Shared types: `BoardProvider`, `Ticket`, `FetchedTicket`, `Board`, `RemoteInfo`, etc. JSDoc all. | Done   |
| 4.2  | Env schemas: `sharedEnvSchema` + 6 board env schemas. Carry over from old repo. TDD.             | Done   |
| 4.3  | Board detection: `detectBoard()` + `sharedEnv()`. TDD + property-based tests.                    | Done   |
| 4.4a | Board API schemas (batch 1): Jira, GitHub, Azure DevOps. TDD with fixture data.                  | Done   |
| 4.4b | Board API schemas (batch 2): Linear, Shortcut, Notion. TDD with fixture data.                    | Done   |

### Dependencies

- 4.0 is prerequisite for all
- 4.1 depends on 4.0
- 4.2 depends on 4.0, 4.1
- 4.3 depends on 4.2
- 4.4a and 4.4b depend on 4.1, can run in parallel with 4.2/4.3

### Phase validation notes (2026-03-24)

**Key findings from breakdown validator + DA:**

1. ~~`z.check()` does not exist in `zod/mini`~~ — **corrected:** `z.check()`, `z.minLength()`, `z.regex()` all work in `zod/mini`. Old repo env schemas can be carried over as-is. `.refine()` is not available on schema instances in mini.
2. `detectBoard()` is 46 lines of detection logic with 30+ test cases — not schema definition. Split into own PR.
3. Board API schemas are ~735 lines across 6 files. Too large for one PR without Copilot review. Split into 2 batches by size.
4. GitLab MR and Bitbucket PR schemas exist in old repo but are git hosting platforms, not boards. Deferred to Phase 6 (`pull-request/`).
5. Missing types from brief: `PrReviewState`, `Ticket` (base type), `FetchTicketOpts`, `Board` — all added to PR 4.1.
6. env-parser (Phase 2) outputs `Record<string, string>` which feeds into `detectBoard()` — no conflict.

## Phase 5: Core — Board Implementations

Adjusted after phase validation (2026-03-24). Pulled HTTP utilities + label helpers into prerequisites PR, moved factory to last, reordered boards by complexity (simplest first).

| PR  | Description                                                                                                                                                | Status |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 5.0 | Prerequisites: `shared/http/` (fetchAndParse, retryFetch, pingEndpoint) + `shared/cache/` (Cached, CachedMap) + label helpers (safeLabel, modifyLabelList) | Done   |
| 5.1 | GitHub board: `board/github/` — REST, simplest board, proves the pattern                                                                                   | Done   |
| 5.2 | Jira board: `board/jira/` — REST, JQL, ADF extraction, transitions, introduces modifyLabelList                                                             | Done   |
| 5.3 | Linear board: `board/linear/` — GraphQL, label ID cache (CachedMap), complex label management                                                              | Done   |
| 5.4 | Shortcut board: `board/shortcut/` — workflow/label caches, dual response shapes                                                                            | Done   |
| 5.5 | Azure DevOps board: `board/azdo/` — WIQL, JSON Patch, batch fetch, tag parsing                                                                             | Done   |
| 5.6 | Notion board: `board/notion/` — retryFetch for rate limits, pagination, dynamic properties                                                                 | Done   |
| 5.7 | Board factory: `board/factory/` — createBoard() dispatch, depends on all 6 boards                                                                          | Done   |

### Dependencies

- 5.0 is prerequisite for all
- 5.1–5.6 all depend on 5.0 but are independent of each other
- 5.7 depends on 5.1–5.6

### File decomposition convention

Each board splits into 2-4 files to stay under the 300-line limit:

- `{board}/api.ts` — fetch, query, ping functions
- `{board}/relations.ts` — blockers, children, transitions
- `{board}/labels.ts` (where needed) — label CRUD
- `{board}/{board}-board.ts` — Board adapter factory

### Cross-cutting decisions (2026-03-24)

1. **Cache strategy** — `Cached<T>` and `CachedMap<K,V>` classes with `#private` fields. `ignoreClasses: true` in ESLint makes this lint-clean. Write method named `store()` (not `set()`) to avoid `immutable-data` pattern-matching.
2. **Param bundling** — Per-board context types (e.g. `JiraContext = { baseUrl, auth }`), constructed from env in the board factory.
3. **`console.warn`** — Accepted as-is. No `no-console` rule. CLI tool context.
4. **Test mocking** — `vi.fn()` on global fetch. No MSW.
5. **Header builders** — Live in respective board modules, not shared.
6. **Export surface** — Export pure functions (validators, builders, parsers) for direct testing. Keep stateful/side-effectful helpers private.

### Phase validation notes (2026-03-24)

**Key findings from breakdown validator + DA:**

1. HTTP utilities (`fetchAndParse`, `retryFetch`, `pingEndpoint`) are a hard blocker — every board depends on them. Pulled forward from Phase 6 as PR 5.0.
2. Label helpers (`safeLabel`, `modifyLabelList`) used by 4 of 6 boards — bundled with 5.0.
3. All 6 board API files exceed 300 lines (range: 395–685). Each needs 2-4 file decomposition.
4. Nearly every API function exceeds max-params: 3. Systematic options-object refactoring needed.
5. Functions exceeding 50 lines: Shortcut `fetchStories` (88), Linear `ensureLabel` (75), Notion `fetchBlockerStatus` (71), Shortcut `fetchBlockerStatus` (63), Jira `fetchTickets` (60).
6. Mutable caches in GitHub, Shortcut, Linear violate `no-let`/`immutable-data` — solved with class-based `Cached<T>`/`CachedMap<K,V>`.
7. Factory must be last PR (depends on all 6 boards).
8. Board order by complexity: GitHub (simplest REST) → Jira (modifyLabelList, JQL) → Linear (GraphQL) → Shortcut (caches, dual responses) → AzDo (WIQL, batch) → Notion (rate limits, pagination).

**Rewrite assessments:**

- Carry over: factory (~0%), label helpers (~0%), board adapters (~10-15%)
- Moderate rewrite: HTTP utilities (~30%), GitHub (~40%), Jira (~40%), AzDo (~40%), Notion (~40%)
- Major rewrite: Linear board adapter (~50%), Shortcut API (~55%)

## Phase 5 Cleanup

Post-merge audit found 4 HIGH, 8 MEDIUM code, 2 MEDIUM export, 6 test gaps. All resolved.

| PR  | Description                                           | Status |
| --- | ----------------------------------------------------- | ------ |
| C1  | Factory exhaustiveness + export hygiene (H4, M9, M10) | Done   |
| C2  | Schema validation + code quality (H1, H2, M1, M2, M7) | Done   |
| C3  | Bug fixes + consistency (M3, M4, M5, M6)              | Done   |
| C4  | Test coverage + JSDoc (T1-T6, M11)                    | Done   |

### Deferred

- H3: Notion findPageByKey full DB scan — needs cache layer, post-Phase 6
- M8: DI on pingEndpoint/retryFetch — touches every test, defer

## Phase 6: Core — Shared Utilities

Adjusted after phase validation (2026-03-25). Brief PRs 6.1-6.3 already done in earlier phases (http/ in 5.0, env-parser/ in 2.0, env-schema/ in 4.2-4.3). Renumbered remaining PRs. Split pull-request/ into 4 PRs (prereqs + 3 platforms). Added fast-check for property-based tests.

| PR   | Description                                                                                                   | Status                   |
| ---- | ------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 6.0  | Prerequisites: add `fast-check` dev dependency                                                                | Done (already installed) |
| 6.1  | `shared/format/`: `formatDuration(ms)` — pure, tiny module                                                    | Done (#32)               |
| 6.2  | `shared/branch/`: `computeTicketBranch`, `computeTargetBranch` — pure, property-based tests                   | Done (#33)               |
| 6.3  | `shared/remote/`: `parseRemote`, `detectPlatformFromHostname`, `buildApiBaseUrl` — pure, property-based tests | Done (#34)               |
| 6.4  | `shared/git-ops/`: git command wrappers + `detectRemote` (DI exec). Depends on 6.3                            | Done (#35)               |
| 6.5  | `shared/progress/`: progress file reader/writer (DI filesystem)                                               | Done (#36)               |
| 6.6  | `shared/feasibility/`: prompt builder + response parser + check (DI invoke)                                   | Done (#37)               |
| 6.7  | `shared/pull-request/` prereqs: `post-pr/` + `rework-comment/` + `pr-body/`. Depends on 6.3                   | Done (#38)               |
| 6.8  | `shared/pull-request/github/`: PR creation, review state, comments. Depends on 6.7                            | Done (#39)               |
| 6.9  | `shared/pull-request/gitlab/`: MR creation, review state, discussions. Depends on 6.7                         | Done (#40)               |
| 6.10 | `shared/pull-request/bitbucket/`: Cloud + Server PR creation, review state. Depends on 6.7                    | Done (#41)               |
| 6.11 | `shared/pull-request/azdo/`: Azure DevOps PR creation, review state. Net-new (no old ref)                     | Done (#42)               |

### Dependencies

- 6.0 is prerequisite for all PRs with property-based tests
- 6.1, 6.2, 6.5, 6.6 are independent of each other
- 6.3 must complete before 6.4 and 6.7
- 6.8, 6.9, 6.10 all depend on 6.7 but are independent of each other

### Phase validation notes (2026-03-25)

**Key findings from validation:**

1. Brief PRs 6.1-6.3 (http, env-parser, env-schema) already implemented in Phases 2, 4, 5. Removed from Phase 6 scope.
2. Types already exist from Phase 4: `RemoteInfo` (7 variants), `PrCreationResult`, `PrReviewState`, `ProgressStatus` + status sets. Phase 6 modules consume these, don't redefine them.
3. Pull-request module is ~1,337 lines across 6 sub-modules. Split into 4 PRs: prereqs (shared helpers) + GitHub + GitLab + Bitbucket.
4. `detectRemote()` placed in `git-ops/` (git shell-out pattern) not `remote/` (stays pure).
5. Property-based tests via `fast-check` (dev dep, 1.4 MB, 1 transitive dep). High value for URL parsing + branch naming. Skip `@fast-check/vitest` — use `fc.assert(fc.property(...))` in normal `it()` blocks.
6. DI boundaries: `git-ops/` injects exec, `progress/` injects filesystem, `feasibility/` injects Claude invoke, `remote/detectRemote` moved to git-ops.
7. GitLab MR + Bitbucket PR schemas (deferred from Phase 4) are now part of PR 6.9 and 6.10.

**Rewrite assessments:**

- Carry over: format (~10%), branch (~15%)
- Moderate rewrite: remote (~40%), git-ops (~40%), progress (~35%), feasibility (~40%), pull-request (~35%)

## Phase 6 Cleanup

Post-merge audit found 4 HIGH, 15 MEDIUM, 16 LOW across all Phase 6 modules. Audit run 2026-03-25.

| PR  | Description                                                                                | Status     |
| --- | ------------------------------------------------------------------------------------------ | ---------- |
| C5  | Progress parser hardening: validate status against union Set, handle `\r\n` (H1, M4, M5)   | Done (#43) |
| C6  | `[clancy]` comment filtering on GitLab, Bitbucket Cloud/Server, AzDO (H2)                  | Done (#44) |
| C7  | Schema validation + PR response schemas + schema tests (H3, M11, M13)                      | Done (#45) |
| C8  | URL encoding + small fixes: branch/since params, empty Closes section, JSDoc (M7-M10, M15) | Done (#46) |
| C9  | Git-ops ref validation + formal review parity documentation (M3, M14)                      | Done (#47) |

### HIGH findings

1. **H1** — `progress/isStatusSegment` matches any ALL_CAPS word ("CI", "API") instead of validating against the `ProgressStatus` union. Could silently misparse progress entries.
2. **H2** — `[clancy]` comment filtering missing from GitLab, Bitbucket Cloud/Server, AzDO. Clancy's own posted comments could trigger false-positive rework loops.
3. **H3** — `parseSuccess` callback in all PR modules uses raw `as` cast on API response data instead of schema validation. Inconsistent with the same files' pattern.
4. **H4** — ~~`azdo-pr.ts`, `bitbucket.ts`, `gitlab.ts` PR schemas not in `schemas/index.ts` barrel.~~ Downgraded — PR schemas consumed via path aliases, adding to barrel causes knip violations. _No fix needed._

### MEDIUM findings

- **M1** — `remote/` exports (`detectPlatformFromHostname`, `buildApiBaseUrl`) with no external consumers. _Deferred — Phase 7 will consume._
- **M2** — `git-ops/ExecGit` type non-exported but needed by consumers. _Deferred — export when consumed._
- **M3** — `git-ops/branchExists` interpolates branch into `refs/heads/${branch}` — semantic ref injection with `../`. → C9
- **M4** — `progress/parseProgressFile` splits on `\n` only — `\r` retained on last segment on Windows. → C5
- **M5** — `as ProgressStatus` cast in `extractTailFields` relies on format check, not union membership. Tied to H1. → C5
- **M6** — `ProgressFs`, `FeasibilityTicket`, `InvokeClaude` types non-exported. _Deferred — export when consumed._
- **M7** — `pr-body/githubClosesLines` emits empty "### Closes" heading when no `#`-prefixed keys exist. → C8
- **M8** — `github/` `since`, `branch`, `owner` params interpolated into URLs without encoding. → C8
- **M9** — Branch name not URL-encoded in query params across all PR platforms. → C8
- **M10** — `gitlab/` `d.id!` non-null assertion avoidable with type narrowing. → C8
- **M11** — No test files for GitLab, Bitbucket, AzDO PR schemas. → C7
- **M12** — No barrel `index.ts` for PR sub-modules. _Deferred — wire when consumers exist._
- **M13** — Bitbucket/GitLab individual comment schemas exported but only consumed internally. → C7
- **M14** — GitHub checks formal reviews (`CHANGES_REQUESTED`); other platforms only check comments. → C9 (document)
- **M15** — `post-pr/basicAuth` JSDoc missing `@param`/`@returns`. → C8

### Deferred

- M1, M2, M6, M12: Export hygiene items deferred until consumers exist (convention: types start non-exported).

## Phase 7: Core — Lifecycle

Adjusted after phase validation (2026-03-25). Added `git-token/` prerequisite (missing from brief, hard blocker). Split `deliver/` into prereqs + main. Added AzDO support to rework-handlers, pr-creation, and outcome. Reordered by dependency.

| PR   | Description                                                                                                    | Status     |
| ---- | -------------------------------------------------------------------------------------------------------------- | ---------- |
| 7.0  | Prerequisites: `git-token/` — resolve platform credentials from SharedEnv + RemoteInfo                         | Done (#48) |
| 7.1  | `lock/`: acquire, release, stale detection (PID + 24h). DI filesystem                                          | Done (#49) |
| 7.2  | `cost/`: duration-based token cost estimation + costs.log writer. DI filesystem                                | Done (#50) |
| 7.3  | `quality/`: quality metric tracking (rework cycles, verification retries, delivery duration). DI filesystem    | Done (#51) |
| 7.4  | `fetch-ticket/`: label resolution, blocker checking, AFK filtering. Consumes Board interface                   | Done (#52) |
| 7.5  | `rework/`: rework detection — `rework-handlers` (platform dispatch) + orchestrator. Depends on 7.0             | Done (#53) |
| 7.5a | Azure DevOps rework: `AzdoRemote` type + `parseRemote`/`buildApiBaseUrl` + rework-handler case. Depends on 7.5 | Done (#54) |
| 7.6  | `resume/`: crash recovery — detect resumable state, execute resume. Depends on 7.0, 7.1                        | Done (#55) |
| 7.7  | `deliver/` prereqs: `outcome/` (pure) + `pr-creation/` (platform dispatch incl. AzDO). Depends on 7.0          | Done (#56) |
| 7.8  | `deliver/`: epic branch management + PR delivery orchestration. Split `deliver.ts` + `epic.ts`. Depends on 7.7 | Done (#57) |

### Dependencies

- 7.0 is prerequisite for 7.5, 7.6, 7.7, 7.8
- 7.1–7.4 are independent of each other and 7.0 (can parallel)
- 7.5 depends on 7.0
- 7.5a depends on 7.5 (adds Azure case to rework-handlers + remote.ts changes)
- 7.6 depends on 7.0 + 7.1 (lock types). Independent of 7.5a
- 7.7 depends on 7.0. Benefits from 7.5a (`AzdoRemote` for pr-creation dispatch)
- 7.8 depends on 7.7

### Phase validation notes (2026-03-25)

**Key findings from validation:**

1. `git-token/` module missing from brief — both `pr-creation` and `rework-handlers` depend on `resolveGitToken(config, remote)` for platform credential resolution. Added as PR 7.0.
2. AzDO support missing in old code (`rework-handlers`, `pr-creation`, `outcome` all treat Azure as unsupported). Now that AzDO PR module exists (#42), all three must dispatch to it.
3. `deliver.ts` is 467 lines — exceeds 300-line limit. Split into `deliver.ts` (PR delivery) + `epic.ts` (epic branch management).
4. `resume/` has 2 functions >50 lines: `detectResume()` (89) and `executeResume()` (123). Both need decomposition.
5. `quality/` uses mutable accumulation (`let` + `+=` in for loop) — refactor to `.reduce()`.
6. `rework-handlers.ts` (224 lines) + `rework.ts` (161 lines) — tightly coupled, keep as 2 files.
7. `outcome.ts` (102 lines) is a pure helper for `deliver/` — bundle with `pr-creation/` in PR 7.7.

**Rewrite assessments:**

- Carry over (~15-20%): lock, cost — small modules, minor DI refactoring
- Moderate rewrite (~30-40%): git-token, quality, fetch-ticket, pr-creation, outcome
- Major rewrite (~45-50%): resume, deliver, rework-handlers — decompose large functions, add AzDO

### Session 20 handoff (2026-03-25)

Completed PRs 7.3–7.5. 1,381 tests passing. Codebase clean.

**What was completed:**

- **7.3 `quality/`** (#51) — atomic writes via temp+rename, `QualityFs` DI, `sumBy` + `hasTicketsRecord` helpers
- **7.4 `fetch-ticket/`** (#52) — recursive `firstUnblocked` (no `for...of`), AFK from `board.sharedEnv()` not `process.env`, `FetchTicketCallOpts` renamed to avoid shadowing board type
- **7.5 `rework/`** (#53) — `PlatformReworkHandlers` uniform interface across 4 platforms, `Ctx` shared builder context (max-params compliant), extracted best-effort helpers for complexity compliance

**What's next:**

- Start 7.6 (`resume/`, depends on 7.0 + 7.1)

**Key decisions:**

- Azure rework deferred to 7.5a — `GenericRemote` doesn't parse org/project/repo needed by azdo PR APIs
- `rework-handlers` uses `default: return undefined` in switch instead of pre-guard on unsupported hosts

### Session 21 handoff (2026-03-25)

Completed PRs 7.5a-7.8 + Phase 7 audit. Phase 7 complete. Codebase clean.

**What was completed:**

- **7.5a Azure DevOps rework** (#54) — `AzdoRemote` type, URL parsing, rework-handler case. Extracted platform builders to `rework-builders.ts`
- **7.6 `resume/`** (#55) — `detectResume` + `executeResume`. Full DI (exec, progressFs). Optional `createPr` callback. Decomposed helpers under 50-line limit
- **7.7 `outcome/` + `pr-creation/`** (#56) — `DispatchCtx` pattern for platform dispatch. `buildManualPrUrl` for all 5 platforms incl. Azure. `DeliveryOutcome` discriminated union
- **7.8 `deliver/` + `epic/` + `commit-type/`** (#57) — `deliverViaPullRequest` returns structured `DeliveryResult` (no console.log). `epic/` extracted to `shared/epic/` for independent reuse. `resolveCommitType` maps board ticket types to feat/fix/chore
- **Phase 7 audit** — 3 HIGH, 12 MEDIUM, 9 LOW. Cleanup PRs C10-C14 planned

**What's next:**

- Phase 7 cleanup: C10 (bugs first), C11-C14 (tests/hygiene)

**Key decisions:**

- `GenericRemote` narrowed to `host: 'unknown'` only — Azure is a first-class discriminated type
- Core modules return structured data, no `console.log` — terminal layer handles display
- `epic/` lives at `shared/epic/` not `shared/deliver/epic/` — zero imports from deliver, independently reusable
- `resolveCommitType` defaults to `feat` when `ticketType` undefined — boards opt in by populating from their API (Shortcut `story_type`, Jira `issuetype`, Azure `WorkItemType`)
- Legacy `visualstudio.com` URLs not supported — low priority, different path structure

## Phase 7 Cleanup

Post-merge audit found 3 HIGH, 12 MEDIUM, 9 LOW across 13 modules. Audit run 2026-03-25.

| PR  | Description                                                                                     | Status     |
| --- | ----------------------------------------------------------------------------------------------- | ---------- |
| C10 | Lock stale bug + quality validation + quality reduce + negative duration guard (H1, H2, M1, L7) | Done (#58) |
| C11 | Rework handler invocation tests + pr-creation result assertions (H3, M6, M9)                    | Done (#59) |
| C12 | Shared types extraction: `ExecGit`, `FetchFn` + rename `Ctx` → `ReworkCtx` (M2, M3, L4)         | Done (#60) |
| C13 | JSDoc `@param` sweep + property-based tests for URL builders/string transformers (M4, M8, L1)   | Done (#61) |
| C14 | Test coverage gaps: deliver, rework, fetch-ticket, epic, cost, commit-type (M5-M7, M10-M12)     | Done (#62) |

### HIGH findings

1. **H1** — `isLockStale` returns `false` for invalid timestamps (`NaN > 24h` → `false`). JSDoc says invalid should be stale. Corrupt `startedAt` with alive PID permanently blocks all runs.
2. **H2** — `readQualityData` casts `raw.tickets as Record<string, QualityEntry>` after only checking it's an object — individual entry shapes unvalidated. Malformed entries produce `NaN` averages.
3. **H3** — `rework-handlers` handler methods never actually invoked in tests. All 5 platforms' wiring is effectively untested — tests only check `typeof` on methods.

### MEDIUM findings

- **M1** — `quality/` uses `.reduce()` — convention says "No reduce()"
- **M2** — `ExecGit` type duplicated in 4 production files (git-ops, resume, epic, deliver). Crossed extraction threshold.
- **M3** — `FetchFn` type duplicated in 3 production files (pr-creation, rework-handlers, deliver)
- **M4** — Missing `@param` tags on ~17 exported functions across lock, cost, quality, rework, fetch-ticket, outcome
- **M5** — `rework/` — MAX_CANDIDATES limit untested; PUSHED/PUSH_FAILED statuses untested; `checkReviewState` throwing untested
- **M6** — `pr-creation/` — no test for API error responses (non-201); result shape never asserted beyond `toBeDefined()`
- **M7** — `deliver/` — no test for PR creation failure outcome; `singleChildParent` untested; only GitHub remote mocked
- **M8** — `commit-type/` — property-based test missing; false-positive substring matches ("debugging" → fix)
- **M9** — `rework-handlers` — `CLANCY_GIT_API_URL` override untested; missing credential tests for non-GitHub platforms
- **M10** — `cost/` — no test for `mkdir` failure propagation
- **M11** — `fetch-ticket/` — `fetchTickets` throwing untested; `fetchBlockerStatus` throwing untested
- **M12** — `epic/` — mixed sibling statuses untested in `buildEpicContext`

### Deferred

- L2: `.clancy` constant duplicated across lock, cost, quality — extract when the value changes
- L3: FS type naming inconsistent (`LockFs`, `CostFs`, etc.) — intentionally varied, correct DI pattern
- L5: `fetchReworkFromPrReview` reconstructs `FetchedTicket` with hardcoded `blockers: 'None'` — documented, acceptable
- L6: `handlePushFailure` returns `{ type: 'local' }` for push failures — semantic mismatch but progress correctly logs `PUSH_FAILED`
- L8: `LockFs`, `CostFs`, `QualityFs` exported for test consumption only — justified when terminal consumes them
- L9: `isLockStale` strict `>` at 24h boundary — documented behaviour, not a bug

## Phase 8: Core — Pipeline

Adjusted after phase validation + DA review (2026-03-25). Orchestration layer tying Phases 5-7 lifecycle modules into a sequential pipeline. 13 phases + context + orchestrator. Split oversized PRs. `notify/` and `prompt/` stay in Phase 9 per brief — cleanup/invoke accept callbacks. **BLOCKING finding:** `functional/immutable-data` rule flags `ctx.field = value` — RunContext must be class-based (`ignoreClasses: true` allows mutation).

| PR   | Description                                                                                                  | Status |
| ---- | ------------------------------------------------------------------------------------------------------------ | ------ |
| 8.0  | Prerequisites: `preflight/` (binary checks, env, git state, DI exec) + `deleteVerifyAttempt` in lock module  | Done   |
| 8.1  | Pipeline context: `RunContext` class (mutation-safe), `Phase` type, `createContext()` factory. TDD           | Done   |
| 8.2a | Phases batch 1a: `lock-check` (105 → decompose), `preflight-phase` (69). Wires to existing `resume/`. TDD    | Done   |
| 8.2b | `deliverEpicToBase`: shared module for epic PR delivery to base branch (122 lines → decompose). TDD          | Done   |
| 8.2c | Phases batch 1c: `epic-completion` (72, consumes deliverEpicToBase), `pr-retry` (142 → decompose). TDD       | Done   |
| 8.3  | Phases batch 2: `rework-detection` (34), `ticket-fetch` (79 → decompose), `dry-run` (38), `feasibility` (39) | Done   |
| 8.4a | Phases batch 3a: `branch-setup` (115 → major decompose), `transition` (19). TDD                              | Done   |
| 8.4b | Phases batch 3b: `deliver-phase` (105 → decompose), `cost-phase` (31), `cleanup` (33, notify callback). TDD  | Done   |
| 8.5  | Pipeline orchestrator: `runPipeline()` — wire all phases, invoke callback injection. TDD                     | Done   |

## Phase 8 Cleanup

Post-merge audit found 3 HIGH, 10 MEDIUM, 14 LOW across 15 pipeline modules. Audit run 2026-03-25.

| PR  | Description                                                                                         | Status     |
| --- | --------------------------------------------------------------------------------------------------- | ---------- |
| C15 | Bugs: deliver fresh progress log + pr-retry prNumber doc + postReworkActions try/catch (H1, M1, M6) | Done       |
| C16 | Time DI + orchestrator error resilience tests (H2, H3, M7, M8)                                      | Done (#73) |
| C17 | Comment hygiene: strip phase numbers, add Safety comments, rename cleanup file (M2, M3, L3, L6)     | Done (#74) |
| C18 | Dead code + type cleanup: remove Phase type, invoke structured result, setter overlap (M4, M5, L7)  | Done (#75) |
| C19 | Test coverage gaps: parentInfo edge, BoardConfig cast, remaining LOW test gaps (M9, M10, L9-L14)    | Done (#76) |

### HIGH findings

1. **H1** — `deliver-phase.ts:deliverFresh` does not log `PUSH_FAILED` progress on push failure (rework path does). Silent failure leaves no trace in progress file.
2. **H2** — `run-pipeline.ts:restoreBranch` + `cleanupLock` catch blocks untested. If `deleteLock` throws, `deleteVerifyAttempt` must still be called — this guarantee is unverified.
3. **H3** — `Date.now()` hardcoded in `RunContext` constructor and `new Date().toISOString()` in `branch-setup:writeLockSafe`. Not injectable — prevents deterministic time testing.

### MEDIUM findings

- **M1** — `pr-retry.ts` records `prNumber: undefined` for "exists" status. `pr.ok` is `false` for `alreadyExists`, so `pr?.ok ? pr.number : undefined` always yields `undefined`.
- **M2** — Hardcoded `Phase N:` numbers in all module JSDoc (15 files) and `run-pipeline.ts` inline comments. Will stale if phases are reordered.
- **M3** — Missing `// Safe: pipeline ordering guarantees...` comments on non-null assertions in 5 `branch-setup.ts` helper functions.
- **M4** — `Phase` type (`(ctx) => boolean`) is dead code — no phase conforms to it. All use `(ctx, deps) => Result`.
- **M5** — `PipelineDeps.invoke` returns raw `Promise<boolean>` — only phase not returning structured `{ ok }` result.
- **M6** — `deliver-phase.ts:deliverRework` — `postReworkActions` rejection propagates unhandled (no try/catch). Could crash pipeline.
- **M7** — `preflight-phase.ts` — `preflight.env` undefined guard (`ok: true` but no env) not tested.
- **M8** — `feasibility.ts` — default reason fallback `'not implementable as code changes'` not tested.
- **M9** — `ticket-fetch.ts` — `parentInfo: ''` treated as `hasParent: true` (empty string edge case untested).
- **M10** — `test-helpers.ts` — `as BoardConfig` cast suppresses type safety for all phase tests.

### LOW findings

- **L1** — `ticket-fetch.ts` — `isRework` remains `undefined` not `false` for non-rework. Safe today (`=== true` convention).
- **L2** — `branch-setup.ts:141` — `ensureBranch(main, main)` in rework standalone. Harmless but odd.
- **L3** — `cleanup-phase/cleanup.ts` — file doesn't match folder name (should be `cleanup-phase.ts`).
- **L4** — Inconsistent `-phase` suffix: 4 folders have it, 9 don't. Function name split similarly.
- **L5** — `pr-retry.ts:110`, `epic-completion.ts:76` — inner arrow functions (20/13 lines) exceed inline callback convention.
- **L6** — `run-pipeline.ts:49-51` — Phase 5 gap in `PipelineDeps` numbering without explanation comment.
- **L7** — `setTicketBranches` and `setBranchSetup` overlap — 4 fields written by both setters silently.
- **L8** — `appendProgress` opts type duplicated across 3 phases (similar but not identical shapes).
- **L9** — `run-pipeline.ts:105` — non-Error thrown value branch not tested.
- **L10** — `run-pipeline.test.ts` — phase execution order not verified (only call count).
- **L11** — `lock-check.ts:94` — `executeResume` rejection in AFK mode not tested.
- **L12** — `branch-setup.ts:207` — `writeLockSafe` with `ticket.description: undefined` not tested.
- **L13** — `branch-setup.ts:125` — `fetchChildrenStatus` returning `undefined` for parented non-rework not explicitly tested.
- **L14** — `cost-phase.ts` — negative token rate not tested.

### Deferred

- `PipelineDeps`/`PipelineResult` exported from core barrel without terminal consumer — Phase 9 will consume
- RunContext at 18 mutable fields — manageable, flag for future growth
- L4 (inconsistent `-phase` suffix) — cosmetic, defer unless renaming happens for other reasons
- L5 (inner arrow functions) — within nesting limit, defer unless surrounding code is modified
- L8 (`appendProgress` type duplication) — shapes aren't identical, defer until a 4th consumer appears

### Dependencies

- 8.0 is prerequisite for 8.2a (preflight module needed by lock-check AFK resume + preflight phase)

## Phase 9: Terminal — Orchestrator

Wire terminal package to core pipeline. Claude CLI bridge, prompt construction, notifications, implement/autopilot entry points. Also: add missing board support (Azure DevOps, Shortcut, Notion) to planner and strategist workflows.

Two independent tracks — board parity (Track A) can proceed in any order relative to orchestrator (Track B).

### Track A — Board parity (planner + strategist workflows)

| PR   | Description                                                                                  | Status |
| ---- | -------------------------------------------------------------------------------------------- | ------ |
| 9.0a | Add Azure DevOps to planner workflows (plan.md + approve-plan.md) + feedback filtering fix   | Done   |
| 9.0b | Add Shortcut to planner workflows (plan.md + approve-plan.md, all dispatch blocks)           | Done   |
| 9.0c | Add Notion to planner workflows (plan.md + approve-plan.md, with documented API limitations) | Done   |
| 9.0d | Add Azure DevOps to strategist workflows (brief.md + approve-brief.md)                       | Done   |
| 9.0e | Add Shortcut to strategist workflows (brief.md + approve-brief.md)                           | Done   |
| 9.0f | Add Notion to strategist workflows (brief.md + approve-brief.md)                             | Done   |

### Track B — Orchestrator

| PR  | Description                                                                           | Status |
| --- | ------------------------------------------------------------------------------------- | ------ |
| 9.1 | Claude CLI bridge: `invokeClaudePrint`, `invokeClaudeSession`. I/O boundary.          | Done   |
| 9.2 | Prompt builder: `buildPrompt`, `buildReworkPrompt`, `ticketLabel`, TDD block.         | Done   |
| 9.3 | Webhook notifications: `sendNotification`, Slack/Teams payload builders.              | Done   |
| 9.4 | Dep factory: `buildPipelineDeps(opts)` — wire all 15 `PipelineDeps` fields.           | Done   |
| 9.5 | Implement entry point: parse args, create context, run pipeline, display result.      | Done   |
| 9.6 | Session report generator: parse costs.log + progress.txt, write session-report.md.    | Done   |
| 9.7 | Autopilot runner: loop orchestration, quiet hours, stop conditions, report + webhook. | Done   |

### Dependencies

- Track A planner: 9.0a → 9.0b → 9.0c (sequential — same files)
- Track A strategist: 9.0d → 9.0e → 9.0f (sequential — same files, independent of planner PRs)
- Track B: 9.1, 9.2, 9.3, 9.6 are independent leaves. 9.4 depends on 9.1 + 9.2 + 9.3. 9.5 (implement) depends on 9.4. 9.7 (autopilot) depends on 9.5 + 9.6 + 9.3.
- Tracks A and B are independent of each other.

### Phase validation notes (2026-03-26)

**Key findings from 4-agent validation sweep:**

1. **PR 9.4 (ANSI utils) from original brief already complete** — `ansi.ts` exists with 7 helpers + 9 tests. Removed from breakdown.
2. **Original PR 9.5 (once orchestrator) too large** — dep factory alone is ~245 lines (15 PipelineDeps fields, 39 sub-deps). Split into dep factory (9.4) + implement entry point (9.5).
3. **Original PR 9.6 (AFK runner) too large** — old code is 308 + 258 lines (afk + report). Split into session report (9.6) + autopilot runner (9.7).
4. **"Desktop notifications" removed** — old code is webhooks only (Slack + Teams). Desktop is new scope, deferred.
5. **Board parity critical** — plan.md + approve-plan.md only handle 3 of 6 boards. Azure DevOps mandatory per project feedback. Added Track A (9.0a/b/c).
6. **Dep factory fits one file** — single `buildPipelineDeps(opts)` with non-exported `SharedResources` type. ~245 lines. No split needed unless future growth forces it.
7. **Notion caveats documented** — no comment editing (post-new fallback), 2000-char property limit (use blocks API for description append).
8. **Notifications needed by dep factory** — cleanup phase takes a `notify` callback, so 9.3 must precede 9.4.

- 8.1 is prerequisite for all phase PRs (RunContext class must exist first)
- 8.2a before 8.2b (lock-check establishes resume pattern)
- 8.2b before 8.2c (epic-completion consumes deliverEpicToBase)
- 8.3 depends on 8.1 only (independent of 8.2)
- 8.4a before 8.4b (deliver depends on branch-setup populating effectiveTarget)
- 8.5 depends on 8.2a-8.4b

### Phase validation notes (2026-03-25)

**Key findings from validation (line-by-line review of 14 old source files):**

1. **Brief's PR 8.2 is too large.** `lock-check` (105 lines, function 85 lines) + `pr-retry` (142 lines, function 115 lines!) = 247 lines of source before tests. Both need decomposition. Split into 8.2a (lock-check + preflight) and 8.2b (epic-completion + pr-retry).
2. **Brief's PR 8.4 is too large.** `branch-setup` (115 lines, function 95 lines!) + `deliver` (105 lines, function 89 lines!) = 220 lines. Both need major decomposition. Split into 8.4a (branch-setup + transition) and 8.4b (deliver + cost + cleanup).
3. **6 functions exceed 50-line limit:** `lockCheck` (85), `prRetry` (115!), `preflight` (57), `epicCompletion` (58), `ticketFetch` (57), `branchSetup` (95!), `deliver` (89!). All need decomposition into helpers.
4. **Missing modules not in core:**
   - `runPreflight` (111 lines) — binary checks, env loading, git state validation. Needed by lock-check (AFK resume) and preflight phase. → PR 8.0
   - `deleteVerifyAttempt` — lock module cleanup helper, called by lock-check and orchestrator. → PR 8.0
   - `deliverEpicToBase` — called by epic-completion, not in new repo. Needs to be built or adapted from `deliverViaPullRequest`. → PR 8.2b
5. **`notify/` and `prompt/` are Phase 9 (brief 9.2, 9.3)** — NOT Phase 8 prerequisites. Cleanup phase accepts a `notifyFn` callback. Invoke phase accepts an `invokeFn` callback. Core doesn't own these implementations.
6. **BLOCKING: `functional/immutable-data` flags `ctx.config = config`** — Verified empirically. `ignoreClasses: true` is set, so **class-based RunContext** with setter methods works (confirmed via lint test). Plain object mutation does NOT work. RunContext must be a class, following the `Cached<T>` pattern from Phase 5.
7. **All 13 phases mix `console.log` with logic.** New versions must return structured results (e.g., `PhaseResult` with `ok`, `message`, `data`). Terminal handles display. This is a significant rewrite for phases with complex output (preflight, ticket-fetch, dry-run, lock-check).
8. **`process.cwd()` and `process.env` calls need DI.** Old context creates from `process.cwd()`/`process.env.CLANCY_AFK_MODE`. New context should accept these as parameters for testability.
9. **Non-null assertions (`ctx.config!`, `ctx.board!`) are acceptable** — phase ordering guarantees these fields are populated. Runtime guards optional (these would be pipeline ordering bugs, not user errors).
10. **Old `invoke` phase sets `process.env.CLANCY_ONCE_ACTIVE = '1'`** during Claude session — this is a side effect that must be handled by the callback, not core.

**Function decomposition plan:**

| Phase           | Old lines | Functions >50 lines   | Decomposition                                                                                           |
| --------------- | --------- | --------------------- | ------------------------------------------------------------------------------------------------------- |
| lock-check      | 105       | `lockCheck` (85)      | Extract: `handleStaleLock`, `attemptResume`                                                             |
| preflight       | 69        | `preflight` (57)      | Extract: banner to data, validation to helpers                                                          |
| epic-completion | 72        | `epicCompletion` (58) | Extract: `findCompletedEpics`, `deliverEpic`                                                            |
| pr-retry        | 142       | `prRetry` (115!)      | Extract: `findRetryable`, `retryEntry`, `handleUnsupportedRemote`                                       |
| ticket-fetch    | 79        | `ticketFetch` (57)    | Extract: `applyMaxReworkGuard`, `computeBranches`                                                       |
| branch-setup    | 115       | `branchSetup` (95!)   | Extract: `checkSingleChild`, `setupReworkBranch`, `setupEpicBranch`, `setupStandalone`, `writeLockSafe` |
| deliver         | 105       | `deliver` (89!)       | Extract: `deliverRework`, `deliverFresh`, `computeParentKeys`                                           |

**Rewrite assessments (per file, based on line-by-line review):**

- Carry over (~10%): transition (19), cost (31), cleanup (33), dry-run (38) — thin wrappers, just strip console.log
- Moderate rewrite (~35-45%): rework-detection (34), feasibility (39), context (59) — adapt to DI, strip ANSI
- Major rewrite (~50-60%): preflight (69), ticket-fetch (79), epic-completion (72) — decompose + strip console.log + adapt APIs
- Heavy rewrite (~60-70%): lock-check (105), deliver (105), branch-setup (115), pr-retry (142) — decompose large functions, remove all I/O, full DI, build missing helpers

### Session 22 handoff (2026-03-25)

Completed Phase 7 cleanup PRs C10-C14 + Phase 8 validation. All phases 1-7 complete. Codebase clean.

**What was completed:**

- **C10** (#58) — `isLockStale` NaN guard, `readQualityData` entry validation, `sumBy` recursive refactor, negative duration clamp
- **C11** (#59) — 7 handler invocation tests across 5 platforms, PR creation result shape assertions, non-201 error test, API URL override + credential tests
- **C12** (#60) — `ExecGit` exported from git-ops (3 dups removed), `FetchFn` exported from pr-creation (2 dups removed), `Ctx` → `ReworkCtx` rename
- **C13** (#61) — `resolveCommitType` word-boundary fix, 6 property-based tests (fast-check), `@param` JSDoc on 12 exported functions
- **C14** (#62) — 11 coverage gap tests across rework, deliver, cost, fetch-ticket, epic
- **Phase 8 validation** — Line-by-line review of 14 old source files + DA validation agent. Found BLOCKING ESLint issue, 4 missing modules, 7 functions >50 lines, split 3 oversized PRs

**What's next:**

- Start Phase 8 with PR 8.0 (prerequisites: `preflight/` module + `deleteVerifyAttempt`)
- Then 8.1 (RunContext CLASS + Phase types + createContext factory)

**Key decisions:**

- **BLOCKING resolved:** `functional/immutable-data` flags `ctx.field = value` on plain objects. RunContext must be a CLASS (verified: `ignoreClasses: true` allows class property mutation). Follow `Cached<T>` pattern from Phase 5
- Split brief's 8.2 into 8.2a/8.2b/8.2c — `deliverEpicToBase` (122 lines) is substantial, needs own PR
- Split brief's 8.4 into 8.4a/8.4b — branch-setup + deliver too large together
- `notify/` and `prompt/` stay in Phase 9 per brief — cleanup/invoke accept callbacks instead
- `deliverEpicToBase` must be built in 8.2b as a shared module — called by epic-completion phase
- `invoke` phase in core is pure callback injection — core builds the prompt, terminal invokes the session
- `resume/` module (Phase 7.6) already exists — lock-check phase wires to it, no new module needed
- Azure DevOps is now supported in rework-handlers (PR 7.5a) — don't carry forward old Azure exclusion from pr-retry
- No console.log in core pipeline — phases return structured data, terminal handles display

Old reference code: `~/Desktop/alex/clancy/src/scripts/once/` — READ-ONLY (maps to new `implement` module). Key files: `context/context.ts` (59 lines), `once.ts` (113 lines), `phases/` (13 files, ~880 lines total). Also check `~/Desktop/alex/clancy/src/scripts/once/deliver/deliver.ts` for `deliverEpicToBase` (122 lines).

### Session 23 handoff (2026-03-25)

Completed PRs 8.0-8.2a. Phase 8 pipeline foundations in place. Codebase clean.

**What was completed:**

- **8.0** (#63) — `shared/preflight/` module with cross-platform binary probing (`--version` not `which`), `ExecCmd` type (not `ExecGit`) for non-git commands, `deleteVerifyAttempt` in lock module. Also: barrel exports added to 15 shared modules (11 shared + 4 pull-request subdirs), all 33 cross-module imports normalised to barrel paths, barrel checks added to DA-REVIEW.md + SELF-REVIEW.md
- **8.1** (#64) — `RunContext` class with `ignoreClasses: true` ESLint pattern, `Phase` type, `createContext()` factory with DI. Block-level `eslint-disable` for `prefer-readonly-type` (justified — no `ignoreClasses` config option exists for that rule)
- **8.2a** (#65) — `lock-check` phase (decomposed to `lockCheck` + `attemptResume`), `preflight-phase` (board detection → validation → ping). 5 setter methods added to RunContext. 28 pipeline tests total

**What's next:**

- Start 8.2b (`deliverEpicToBase` shared module — 122 lines from old code, needs decomposition)
- Then 8.2c (epic-completion + pr-retry phases)

**Critical discovery — `ignoreClasses: true` scope:**

The `functional/immutable-data` rule's `ignoreClasses: true` option ONLY allows `this.field = value` inside class methods/constructors. It does NOT allow `instance.field = value` from external code — ESLint cannot do type analysis to know the variable is a class instance. This means **all phases must use RunContext setter methods** (`setPreflight`, `setRework`, `setTicket`, `setBranchSetup`, `setLockOwner`) instead of direct property assignment. This was discovered empirically during 8.2a when lint flagged `ctx.config = boardResult` in the preflight phase.

**Key decisions:**

- Barrel exports normalised across all shared modules — convention is now: every module with external consumers has an `index.ts` barrel, imports use `/index.js` path
- `PreflightPhaseDeps.runPreflight` takes only `projectRoot` (single arg) — the `exec`/`envFs` deps are pre-wired by the terminal layer, not passed through the phase
- Lock-check `LockCheckDeps` defines resume function types explicitly (not `typeof import`) to avoid value imports that lint flags as type-only
- Phases return structured result types (`LockCheckResult`, `PreflightPhaseResult`) — no `console.log` in core

### Session 25 handoff (2026-03-25)

Completed PRs 8.3-8.4a. Phase 8 pipeline phases 3-8 in place. 108 pipeline tests. Codebase clean.

**What was completed:**

- **8.3** (#68) — 4 lighter phases: `rework-detection` (detect PR rework via DI, best-effort), `ticket-fetch` (fresh fetch or rework, max rework guard, branch computation), `dry-run` (structured ticket info for display, no I/O), `feasibility` (async Claude feasibility check via DI). Added `setTicketBranches` setter to RunContext. Shared `test-helpers.ts` for board mock deduplication. Restructured all 8 phases into individual directories (`phases/lock-check/`, `phases/dry-run/`, etc.) to match the one-module-per-directory convention. Barrel exports deferred to 8.5. 36 new tests
- **8.4a** (#69) — `branch-setup` phase (decomposed into `checkSingleChild`, `setupReworkBranch`, `setupFreshBranch`, `setupEpicBranch`, `setupStandalone`, `writeLockSafe` — all ≤3 params via ctx-reading pattern). `transition` phase (best-effort ticket status update). `fetchChildrenStatus` dep takes `FetchedTicket` (higher-level callback, not raw Board params). 23 new tests

**What's next:**

- Start 8.4b (deliver-phase + cost-phase + cleanup)
- Then 8.5 (pipeline orchestrator)

**Key decisions:**

- `setTicketBranches` added to RunContext — ticket-fetch computes branch names, branch-setup (8.4a) later overwrites with `setBranchSetup` adding `effectiveTarget`/`originalBranch`
- `parseMaxRework` accepts `>= 0` (not `> 0`) — `CLANCY_MAX_REWORK=0` means "no rework allowed". Higher standard than old code which silently treated 0 as default 3
- `feasibilityPhase` and its `checkFeasibility` dep are async — Claude invocation spawns a subprocess, making the dep async-ready avoids a breaking change later
- `applyMaxReworkGuard` takes `BoardConfig` (not widened `Record<string, string | undefined>`) — preserves type safety for env key access
- Non-null assertion comments added per DA review — `// Safe: pipeline ordering guarantees ...`
- Shared `test-helpers.ts` with `makeCtx()` + internal `makeBoard()` — prevents Board mock drift across 4+ test files
- `ctx.isRework === true` used consistently (not truthy check) — clear handling of `boolean | undefined`
- Phases restructured into individual directories (`phases/<name>/<name>.ts`) — matches `shared/` one-module-per-directory convention. Barrel `index.ts` files deferred to 8.5 per export hygiene (no consumers yet). `test-helpers.ts` stays at `phases/` level as shared test utility
- `fetchChildrenStatus` dep takes `FetchedTicket` not raw `(parentKey, parentId?, currentTicketKey?)` — higher-level callback pattern per DI convention. Terminal layer extracts the board-specific fields

### Session 26 handoff (2026-03-25)

Completed PRs 8.4b, 8.5, C15, and Phase 8 audit. Phase 8 complete + first cleanup PR merged. 161 pipeline tests. Codebase clean.

**What was completed:**

- **8.4b** (#70) — 3 phases: `deliver-phase` (decomposed into `deliverRework`, `deliverFresh`, `computeParentKeys`, `resolveSingleChildParent`), `cost-phase` (thin wrapper with `parseTokenRate` helper), `cleanup-phase` (completion data + notify callback). All best-effort error handling. 27 new tests
- **8.5** (#71) — Pipeline orchestrator: `runPipeline(ctx, deps)` with `PipelineDeps` type aggregating all phase deps. Pipeline barrel + core barrel re-exports. `PipelineResult` discriminated union (`completed | aborted | resumed | dry-run | error`). try/catch/finally for lock cleanup. 22 orchestrator tests. Phase barrel `index.ts` files deferred to Phase 9 (terminal layer is the actual consumer — orchestrator uses DI callbacks)
- **Phase 8 audit** — 4 parallel agents (bugs, conventions, test coverage, architecture). 3 HIGH, 10 MEDIUM, 14 LOW. 5 cleanup PRs planned (C15-C19)
- **C15** (#72) — H1 (`deliverFresh` now logs `PUSH_FAILED` progress), M6 (`postReworkActions` try/catch), M1 (documented pr-retry prNumber limitation). 2 new tests

**What's next:**

- C16 (Time DI + orchestrator error resilience tests — H2, H3, M7, M8)
- C17 (Comment hygiene — M2, M3, L3, L6)
- C18 (Dead code + type cleanup — M4, M5, L7)
- C19 (Test coverage gaps — M9, M10, L9-L14)
- Then Phase 9 (terminal wiring)

**Key decisions:**

- Directory naming uses `-phase` suffix (`deliver-phase/`, `cost-phase/`, `cleanup-phase/`) to avoid collision with existing `shared/` modules (`shared/cost/`, `shared/deliver-ticket/`)
- `costPhase` is synchronous (no async I/O) — `Phase` type already supports `Promise<boolean> | boolean`
- `deliver-phase` DI pattern: `deliverViaPullRequest` dep is pre-wired with exec/fetchFn/config/ticket by terminal layer, phase only passes delivery-specific opts (ticketBranch, targetBranch, parent, etc.)
- `singleChildParent` GitHub validation: only valid `#N` refs pass through — milestone titles like "Sprint 3" would produce invalid "Closes Sprint 3" lines
- `cleanup-phase` returns `CleanupResult` with `ticketKey`, `ticketTitle`, `elapsedMs` — terminal formats the display
- `PipelineDeps` uses minimal return type shapes (not full phase result types) — keeps orchestrator decoupled from phase internals

### Session 27 handoff (2026-03-25)

Completed Phase 8 cleanup PRs C16-C19. All audit findings resolved. 174 pipeline tests. Codebase clean.

**What was completed:**

- **C16** (#73) — Time DI: optional `now` in `CreateContextOpts` (epoch ms) + `BranchSetupDeps.now` (ISO factory). 4 orchestrator error resilience tests (checkout/deleteLock/deleteVerifyAttempt throws, non-Error thrown). preflight env-undefined guard test. Feasibility default reason fallback test. 9 new tests
- **C17** (#74) — Comment hygiene: stripped `Phase N:` prefixes from 13 module JSDoc headers + `run-pipeline.ts` inline/JSDoc comments. Added `// Safe:` comments to 5 branch-setup helpers. Renamed `cleanup.ts` → `cleanup-phase.ts`. Added dry-run dependency comment in `PipelineDeps`
- **C18** (#75) — Dead code removal: deleted `Phase` type (no phase conforms to `(ctx) => boolean`). Changed `PipelineDeps.invoke` from `Promise<boolean>` to `Promise<{ readonly ok: boolean }>`. Documented `setTicketBranches`/`setBranchSetup` overlap
- **C19** (#76) — Test coverage: `parentInfo: ''` edge case, typed `makeBoardConfig()` builder replacing `as BoardConfig` cast, phase execution order verification, `executeResume` rejection, `writeLockSafe` with `description: undefined`, `fetchChildrenStatus` returning undefined, negative token rate. 6 new tests

**What's next:**

- Phase 2 cleanup (C20-C24), then Phase 9 (terminal wiring)

**Key decisions:**

- Time DI uses two shapes: `CreateContextOpts.now` is a plain `number` (eager snapshot at context creation), `BranchSetupDeps.now` is `() => string` (lazy ISO factory because `writeLockSafe` runs later). Both documented
- `makeBoardConfig()` in test-helpers supports all 6 providers with valid required env fields — eliminates all `as BoardConfig` casts in phase tests
- `Phase` type removed entirely — all phases use `(ctx, deps) => StructuredResult` pattern, not `(ctx) => boolean`
- `PipelineDeps.invoke` now returns `{ ok: boolean }` like all other phases — consistency over backwards compatibility (no consumers yet)
- Lock-check runs outside try/catch — if it aborts, no lock was acquired so no cleanup needed
- `restoreBranch` in catch block, `cleanupLock` in finally block — guarantees cleanup on all paths
- Dry-run gate uses `ctx.dryRun` directly, not a phase dep — the `dryRun` phase module is a standalone utility for ticket info display
- Phase barrel `index.ts` files deferred again — orchestrator uses DI callbacks (not direct imports), terminal layer (Phase 9) is the actual consumer per export hygiene convention
- M1 (pr-retry prNumber for "exists") documented as limitation — `PrCreationFailure` type doesn't carry the PR number, fix belongs in PR creation layer not pipeline

### Session 24 handoff (2026-03-25)

Completed PRs 8.2b-8.2c. Phase 8 pipeline phases 0-2a in place. Codebase clean.

**What was completed:**

- **8.2b** (#66) — `deliver-epic/` shared module: creates final PR from epic branch to base branch. Full DI, `resolveCommitType` for PR title, 12 tests. Also renamed `deliver/` → `deliver-ticket/` for clarity, added `buildEpicPrBody` + `gatherChildEntries` barrel exports
- **8.2c** (#67) — `epic-completion` phase (scans progress for completed epics, creates epic PRs via DI) + `pr-retry` phase (retries PR creation for PUSHED tickets). Both use `Promise.all` + `.map()` (no `for...of`), best-effort try/catch. Decomposed pr-retry into `classifyResult`, `handleUnsupportedRemote`, `normaliseParent`. 22 tests total

**What's next:**

- Start 8.3 (rework-detection, ticket-fetch, dry-run, feasibility — 4 phases in one PR)
- Then 8.4a (branch-setup + transition)

**Key decisions:**

- `deliver/` renamed to `deliver-ticket/` — clear symmetry with `deliver-epic/`, avoids confusion
- Phase DI pattern: I/O deps (exec, fetchFn, progressFs) are pre-wired by terminal layer, phases receive higher-level callbacks. E.g., `EpicCompletionDeps.deliverEpicToBase` takes only epic-specific args, not raw I/O deps
- `epicTitle` falls back to `epicKey` — title not available from progress file, key is the only identifier
- `for...of` loops replaced with `.map()` + `Promise.all()` — `functional/no-loop-statements` is `warn` but convention is no loops
- Result types (`EpicCompletionResult`, `PrRetryResult`) start non-exported per convention — will export when orchestrator (8.5) consumes them
- `computeTargetBranch` barrel export deferred — will add when consumed by branch-setup (8.4a)
- `process` variable renamed to `retryOne` to avoid shadowing Node global
- Azure DevOps first-class in pr-retry — old code excluded `azure` from PR creation, new code does not
