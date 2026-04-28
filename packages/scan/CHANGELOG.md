# @chief-clancy/scan

## 0.3.0

### Minor Changes

- [#419](https://github.com/Pushedskydiver/chief-clancy/pull/419) [`a717ac3`](https://github.com/Pushedskydiver/chief-clancy/commit/a717ac36003d8b70b83b935eb5fe8a8251da71cd) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Move `.clancy/` to fully gitignored.

  `/clancy:init` (terminal) now writes `.clancy/` to `.gitignore` (covering all artifacts including `.env`, `.env.example`, `docs/`, `version.json`, `package.json`, and bundled scripts). The init scaffold commit stages only parent-project files (`CLAUDE.md` + `.gitignore`).

  `/clancy:map-codebase` and `/clancy:update-docs` (scan) no longer commit; their writes are local-only.

  `/clancy:uninstall-terminal` accepts both new (`.clancy/`) and legacy (`.clancy/.env`) gitignore markers and removes ALL Clancy marker pairs found (legacy and current may coexist after migration). New Step 5b commits the parent-project cleanup (CLAUDE.md + .gitignore) before offering to remove `.clancy/`.

  `/clancy:update-terminal` prints a one-time migration advisory (idempotent against partial state) for projects that were init'd before the gitignore fold and still have tracked content under `.clancy/`. The advisory prints branch-conditional commands (including `git add .gitignore` to stage the gitignore append).

  Standalone packages (`@chief-clancy/brief`, `@chief-clancy/plan`, `@chief-clancy/dev`) board-setup workflows now suggest gitignoring `.clancy/` (not the legacy `.clancy/.env`) for symmetric treatment with terminal — covers credentials plus all local Clancy artifacts.

  Migration: existing projects with tracked `.clancy/` content will see the advisory after running `/clancy:update-terminal`. Run the printed commands to migrate.

## 0.2.3

### Patch Changes

- [#286](https://github.com/Pushedskydiver/chief-clancy/pull/286) [`404a224`](https://github.com/Pushedskydiver/chief-clancy/commit/404a2240e157ae0d61e627dedcd656551eda0ed6) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add `--from` support to the implement pipeline for local plan execution.

  **dev (minor):** Plan file parser (`parsePlanFile`, `checkApprovalStatus`, `toSyntheticTicket`), local-mode infrastructure (no-op board, synthetic config, local preflight), pipeline wiring for `--from`, directory listing with natural sort (`listPlanFiles`), and public API exports for all plan-file utilities.

  **terminal (patch):** Batch runner (`runImplementBatch`) for `--from {directory} --afk`, implement entry point with directory detection and `--afk` dispatch, workflow and command docs for batch mode, e2e tests for local plan pipeline and lifecycle contracts.

  **plan (patch):** README updated — replaced deferred `implement-from` text with shipped `--from` usage docs pointing at `chief-clancy` and `/clancy:implement`.

  **chief-clancy, core, brief, scan (patch):** README consistency pass — standardised monorepo link ordering (dependency-first), section naming, early-stage warning, and `--from` mentions where applicable.

## 0.2.2

### Patch Changes

- [#260](https://github.com/Pushedskydiver/chief-clancy/pull/260) [`fb22c36`](https://github.com/Pushedskydiver/chief-clancy/commit/fb22c36bc4d3ace684ea8f8dfee00364e7c9c137) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Initial public release of @chief-clancy/dev — autonomous ticket executor with readiness gate, AFK loop, and structured artifact reporting. All package READMEs standardised with consistent monorepo section, credits, and license. Terminal bumped to pick up dev 0.1.0 dependency.

## 0.2.1

### Patch Changes

- [#248](https://github.com/Pushedskydiver/chief-clancy/pull/248) [`a0c7145`](https://github.com/Pushedskydiver/chief-clancy/commit/a0c71458edc5a38d893ef93e1aa33f4ffea7c368) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add scan README and update all package READMEs with scan references.

## 0.2.0

### Minor Changes

- [#246](https://github.com/Pushedskydiver/chief-clancy/pull/246) [`a22f4ad`](https://github.com/Pushedskydiver/chief-clancy/commit/a22f4adbd1df9d08c8777a5165824c21d61be029) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - New `@chief-clancy/scan` package — shared codebase scanning agents and workflows (map-codebase, update-docs) consumed by dev, brief, plan, and terminal. Single source of truth replaces per-package duplicates.
