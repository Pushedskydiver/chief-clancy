# Monorepo Progress

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

| PR  | Description                                                                                                    | Status  |
| --- | -------------------------------------------------------------------------------------------------------------- | ------- |
| 7.0 | Prerequisites: `git-token/` — resolve platform credentials from SharedEnv + RemoteInfo                         | Done    |
| 7.1 | `lock/`: acquire, release, stale detection (PID + 24h). DI filesystem                                          | Pending |
| 7.2 | `cost/`: duration-based token cost estimation + costs.log writer. DI filesystem                                | Pending |
| 7.3 | `quality/`: quality metric tracking (rework cycles, verification retries, delivery duration). DI filesystem    | Pending |
| 7.4 | `fetch-ticket/`: label resolution, blocker checking, AFK filtering. Consumes Board interface                   | Pending |
| 7.5 | `rework/`: rework detection — `rework-handlers` (platform dispatch incl. AzDO) + orchestrator. Depends on 7.0  | Pending |
| 7.6 | `resume/`: crash recovery — detect resumable state, execute resume. Depends on 7.0, 7.1                        | Pending |
| 7.7 | `deliver/` prereqs: `outcome/` (pure) + `pr-creation/` (platform dispatch incl. AzDO). Depends on 7.0          | Pending |
| 7.8 | `deliver/`: epic branch management + PR delivery orchestration. Split `deliver.ts` + `epic.ts`. Depends on 7.7 | Pending |

### Dependencies

- 7.0 is prerequisite for 7.5, 7.6, 7.7, 7.8
- 7.1–7.4 are independent of each other and 7.0 (can parallel)
- 7.5 depends on 7.0
- 7.6 depends on 7.0 + 7.1 (lock types)
- 7.7 depends on 7.0
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
