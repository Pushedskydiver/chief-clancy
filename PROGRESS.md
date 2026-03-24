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

| PR  | Description                                                                                                                                                | Status  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 5.0 | Prerequisites: `shared/http/` (fetchAndParse, retryFetch, pingEndpoint) + `shared/cache/` (Cached, CachedMap) + label helpers (safeLabel, modifyLabelList) | Done    |
| 5.1 | GitHub board: `board/github/` — REST, simplest board, proves the pattern                                                                                   | Done    |
| 5.2 | Jira board: `board/jira/` — REST, JQL, ADF extraction, transitions, introduces modifyLabelList                                                             | Done    |
| 5.3 | Linear board: `board/linear/` — GraphQL, label ID cache (CachedMap), complex label management                                                              | Done    |
| 5.4 | Shortcut board: `board/shortcut/` — workflow/label caches, dual response shapes                                                                            | Done    |
| 5.5 | Azure DevOps board: `board/azdo/` — WIQL, JSON Patch, batch fetch, tag parsing                                                                             | Done    |
| 5.6 | Notion board: `board/notion/` — retryFetch for rate limits, pagination, dynamic properties                                                                 | Pending |
| 5.7 | Board factory: `board/factory/` — createBoard() dispatch, depends on all 6 boards                                                                          | Pending |

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
