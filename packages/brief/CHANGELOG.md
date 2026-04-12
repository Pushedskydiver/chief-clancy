# @chief-clancy/brief

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
