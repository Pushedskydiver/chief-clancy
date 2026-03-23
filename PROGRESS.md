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

| PR  | Description                                                                   | Status      |
| --- | ----------------------------------------------------------------------------- | ----------- |
| 2.0 | Prerequisites: `terminal/src/shared/ansi/` + `core/src/shared/env-parser/`    | Done        |
| 2.1 | File operations: `file-ops/` — fileHash, copyDir, inlineWorkflows             | Done        |
| 2.2 | Prompts + UI: `prompts/` (DI readline) + `ui/` (banner, success)              | Not started |
| 2.3 | Manifest: `manifest/` — buildManifest, detectModified, backup (immutable)     | Not started |
| 2.4 | Hook installer: `hook-installer/` — register hooks immutably in settings.json | Not started |
| 2.5 | Role filter: `role-filter/` — determineRoles, copyRoleFiles, cleanDisabled    | Not started |
| 2.6 | Orchestrator: `install.ts` — decomposed main(), runInstall(config) pipeline   | Not started |
| 2.7 | Integration test: E2E against temp directory, fresh + update paths            | Not started |

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
