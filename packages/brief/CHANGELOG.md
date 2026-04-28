# @chief-clancy/brief

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
  - @chief-clancy/scan@0.3.0

## 0.4.3

### Patch Changes

- [#286](https://github.com/Pushedskydiver/chief-clancy/pull/286) [`404a224`](https://github.com/Pushedskydiver/chief-clancy/commit/404a2240e157ae0d61e627dedcd656551eda0ed6) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add `--from` support to the implement pipeline for local plan execution.

  **dev (minor):** Plan file parser (`parsePlanFile`, `checkApprovalStatus`, `toSyntheticTicket`), local-mode infrastructure (no-op board, synthetic config, local preflight), pipeline wiring for `--from`, directory listing with natural sort (`listPlanFiles`), and public API exports for all plan-file utilities.

  **terminal (patch):** Batch runner (`runImplementBatch`) for `--from {directory} --afk`, implement entry point with directory detection and `--afk` dispatch, workflow and command docs for batch mode, e2e tests for local plan pipeline and lifecycle contracts.

  **plan (patch):** README updated — replaced deferred `implement-from` text with shipped `--from` usage docs pointing at `chief-clancy` and `/clancy:implement`.

  **chief-clancy, core, brief, scan (patch):** README consistency pass — standardised monorepo link ordering (dependency-first), section naming, early-stage warning, and `--from` mentions where applicable.

- Updated dependencies [[`404a224`](https://github.com/Pushedskydiver/chief-clancy/commit/404a2240e157ae0d61e627dedcd656551eda0ed6)]:
  - @chief-clancy/scan@0.2.3

## 0.4.2

### Patch Changes

- [#279](https://github.com/Pushedskydiver/chief-clancy/pull/279) [`9796262`](https://github.com/Pushedskydiver/chief-clancy/commit/979626235383335cb667cdd59e1242825930402d) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Plan: add devil's advocate agent with Step 4g DA grill, 6-item plan health check, and installer infrastructure

  Brief: improve DA agent with dual-mode operation (grill + health-check), Challenges section, severity levels, Step 8a post-brief invocation, and brief health check preamble

## 0.4.1

### Patch Changes

- [#275](https://github.com/Pushedskydiver/chief-clancy/pull/275) [`b3eb148`](https://github.com/Pushedskydiver/chief-clancy/commit/b3eb148d95217593c3d19e471b3bb2884dfda076) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add "Updating" sections to READMEs for per-package update commands and rename `/clancy:update` to `/clancy:update-terminal` in terminal's Setup commands table.

## 0.4.0

### Minor Changes

- [#273](https://github.com/Pushedskydiver/chief-clancy/pull/273) [`951f908`](https://github.com/Pushedskydiver/chief-clancy/commit/951f90877bc1fc1ac20b9da1c8a4201950adcc3d) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add per-package update commands (`/clancy:update-brief`, `/clancy:update-plan`, `/clancy:update-dev`) and rename terminal's `/clancy:update` to `/clancy:update-terminal` with a thin redirect at the old location.

  Each standalone update workflow: version detection via VERSION marker, npm latest check with 5s timeout, changelog from GitHub releases API (URL-encoded tags), terminal coexistence + standalone package advisories, install mode detection (local/global/both), `--afk` confirmation skip, `npx @latest` cache bypass, post-update verification.

  Uninstall workflows updated to list update files for deletion. Installer file lists and printSuccess output updated across all packages.

## 0.3.4

### Patch Changes

- [#267](https://github.com/Pushedskydiver/chief-clancy/pull/267) [`a65c3ee`](https://github.com/Pushedskydiver/chief-clancy/commit/a65c3ee46515b5339f1d1d1e24ed1103e6798e99) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Cross-package uninstall commands. Each standalone package now ships its own uninstall (`/clancy:uninstall-brief`, `/clancy:uninstall-plan`, `/clancy:uninstall-dev`). Terminal's uninstall renamed to `/clancy:uninstall-terminal` with package-aware detection — checks VERSION markers, warns about standalone packages before proceeding, and provides reinstall guidance.

## 0.3.3

### Patch Changes

- [#260](https://github.com/Pushedskydiver/chief-clancy/pull/260) [`fb22c36`](https://github.com/Pushedskydiver/chief-clancy/commit/fb22c36bc4d3ace684ea8f8dfee00364e7c9c137) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Initial public release of @chief-clancy/dev — autonomous ticket executor with readiness gate, AFK loop, and structured artifact reporting. All package READMEs standardised with consistent monorepo section, credits, and license. Terminal bumped to pick up dev 0.1.0 dependency.

- Updated dependencies [[`fb22c36`](https://github.com/Pushedskydiver/chief-clancy/commit/fb22c36bc4d3ace684ea8f8dfee00364e7c9c137)]:
  - @chief-clancy/scan@0.2.2

## 0.3.2

### Patch Changes

- [#248](https://github.com/Pushedskydiver/chief-clancy/pull/248) [`a0c7145`](https://github.com/Pushedskydiver/chief-clancy/commit/a0c71458edc5a38d893ef93e1aa33f4ffea7c368) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add scan README and update all package READMEs with scan references.

- Updated dependencies [[`a0c7145`](https://github.com/Pushedskydiver/chief-clancy/commit/a0c71458edc5a38d893ef93e1aa33f4ffea7c368)]:
  - @chief-clancy/scan@0.2.1

## 0.3.1

### Patch Changes

- [#246](https://github.com/Pushedskydiver/chief-clancy/pull/246) [`a22f4ad`](https://github.com/Pushedskydiver/chief-clancy/commit/a22f4adbd1df9d08c8777a5165824c21d61be029) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - New `@chief-clancy/scan` package — shared codebase scanning agents and workflows (map-codebase, update-docs) consumed by dev, brief, plan, and terminal. Single source of truth replaces per-package duplicates.

- Updated dependencies [[`a22f4ad`](https://github.com/Pushedskydiver/chief-clancy/commit/a22f4adbd1df9d08c8777a5165824c21d61be029)]:
  - @chief-clancy/scan@0.2.0

## 0.3.0

### Minor Changes

- [#222](https://github.com/Pushedskydiver/chief-clancy/pull/222) [`9f27a77`](https://github.com/Pushedskydiver/chief-clancy/commit/9f27a7773e353bfc28482b83249cff36e9771088) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - ✨ feat(brief): standalone+board approve-brief — install-mode preflight + label-decision preamble

  Two coupled changes to `/clancy:approve-brief` that close the standalone+board UX cliff:

  **Step 1 install-mode preflight.** approve-brief now classifies into three install contexts using the same `.clancy/.env` and `.clancy/clancy-implement.js` probes as `/clancy:plan` and `/clancy:approve-plan`. Standalone (no `.clancy/.env`) hard-stops with a `/clancy:board-setup` message — unlike approve-plan which writes a local marker, approve-brief has nothing to do without a board (its job is to create tickets ON the board). Standalone+board and terminal modes both run normally. The strategist role check is now scoped to terminal-mode preflight only (standalone+board users have no `CLANCY_ROLES`).

  **Step 6 pipeline label selection rule.** The 3-rule label-decision fallthrough that lived in the GitHub subsection is lifted into a Step 6 preamble that all six platform subsections delegate to. The new rule covers four cases in precedence order: `--skip-plan` flag → build, standalone+board → plan (regardless of `CLANCY_ROLES`), terminal+planner enabled → plan, terminal+planner not enabled → build. This fixes a real bug where standalone+board users (no `CLANCY_ROLES` set) were silently routed to the build queue, breaking the `/clancy:plan` flow. All six platform subsections now reference the preamble rather than re-enumerating it.

  `packages/brief/README.md` gains an "Approving briefs" section mirroring the post-PR-9 plan README's three-mode shape (Standalone / Standalone+board / Terminal mode), without the `--push` / `--ticket` flag content (approve-brief introduces no new flags).

## 0.2.0

### Minor Changes

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

## 0.1.2

### Patch Changes

- [`a682f18`](https://github.com/Pushedskydiver/chief-clancy/commit/a682f184a0c95d87a4ebec59cf5f906f2bc7cc59) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add /clancy:board-setup command for standalone board credential configuration. Three-state mode detection (standalone, standalone+board, terminal) unlocks board ticket mode without the full pipeline.

## 0.1.1

### Patch Changes

- [#187](https://github.com/Pushedskydiver/chief-clancy/pull/187) [`a0a2a7c`](https://github.com/Pushedskydiver/chief-clancy/commit/a0a2a7ca2748efb42ae1e82b689b92c26a4bf7fa) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add README to npm package
