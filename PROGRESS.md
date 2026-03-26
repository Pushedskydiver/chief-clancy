# Monorepo Progress

## Session 30 Handoff

**Starting Phase 9: Terminal — orchestrator.** Validated breakdown, beginning implementation.

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

| PR  | Description                                                                                                                  | Status  |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ------- |
| C20 | Shared helpers: extract `isPlainObject` + `rejectSymlink` → `shared/`, replace `isEnoent`, add barrel (H2, M1-M4, M12)       | Done    |
| C21 | TOCTOU fix + safety: wrap `resolveWorkflowRef` try/catch, `isFile()` guard in `copyEntry`, stale statusLine (H3, M5, M7)     | Done    |
| C22 | Test coverage: non-ENOENT re-throws, installHooks failure, confirmOverwrite edges, fs-errors tests (H4-H6, M8-M10, L10-L12)  | Done    |
| C23 | Comment hygiene + export cleanup: `as` cast comments, `@returns` JSDoc, remove over-exports, chain fix (M13, L1, L7-L9, L15) | Done    |
| C24 | `cleanDisabledFiles` recursive cleanup + hook-installer catch improvement (H1, M6)                                            | Done    |

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

Wire terminal package to core pipeline. Claude CLI bridge, prompt construction, notifications, once/AFK entry points. Also: add missing board support (Azure DevOps, Shortcut, Notion) to planner workflows.

Two independent tracks — board parity (Track A) can proceed in any order relative to orchestrator (Track B).

### Track A — Board parity (planner workflows)

| PR   | Description                                                                                  | Status  |
| ---- | -------------------------------------------------------------------------------------------- | ------- |
| 9.0a | Add Azure DevOps to planner workflows (plan.md + approve-plan.md, all dispatch blocks)       | Pending |
| 9.0b | Add Shortcut to planner workflows (plan.md + approve-plan.md, all dispatch blocks)           | Pending |
| 9.0c | Add Notion to planner workflows (plan.md + approve-plan.md, with documented API limitations) | Pending |

### Track B — Orchestrator

| PR  | Description                                                                            | Status  |
| --- | -------------------------------------------------------------------------------------- | ------- |
| 9.1 | Claude CLI bridge: `invokeClaudePrint`, `invokeClaudeSession`. I/O boundary.           | Pending |
| 9.2 | Prompt builder: `buildPrompt`, `buildReworkPrompt`, `ticketLabel`, TDD block.          | Pending |
| 9.3 | Webhook notifications: `sendNotification`, Slack/Teams payload builders.               | Pending |
| 9.4 | Dep factory: `buildPipelineDeps(opts)` — wire all 15 `PipelineDeps` fields.            | Pending |
| 9.5 | Once entry point + display: parse args, load env, create context, run pipeline.        | Pending |
| 9.6 | Session report generator: parse costs.log + progress.txt, write session-report.md.     | Pending |
| 9.7 | AFK runner: loop orchestration, quiet hours, stop conditions, session report + webhook. | Pending |

### Dependencies

- Track A: 9.0a → 9.0b → 9.0c (sequential — same files)
- Track B: 9.1, 9.2, 9.3, 9.6 are independent leaves. 9.4 depends on 9.1 + 9.2 + 9.3. 9.5 depends on 9.4. 9.7 depends on 9.5 + 9.6 + 9.3.
- Tracks A and B are independent of each other.

### Phase validation notes (2026-03-26)

**Key findings from 4-agent validation sweep:**

1. **PR 9.4 (ANSI utils) from original brief already complete** — `ansi.ts` exists with 7 helpers + 9 tests. Removed from breakdown.
2. **Original PR 9.5 (once orchestrator) too large** — dep factory alone is ~245 lines (15 PipelineDeps fields, 39 sub-deps). Split into dep factory (9.4) + entry point (9.5).
3. **Original PR 9.6 (AFK runner) too large** — old code is 308 + 258 lines (afk + report). Split into session report (9.6) + AFK runner (9.7).
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

Old reference code: `~/Desktop/alex/clancy/src/scripts/once/` — READ-ONLY. Key files: `context/context.ts` (59 lines), `once.ts` (113 lines), `phases/` (13 files, ~880 lines total). Also check `~/Desktop/alex/clancy/src/scripts/once/deliver/deliver.ts` for `deliverEpicToBase` (122 lines).

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
