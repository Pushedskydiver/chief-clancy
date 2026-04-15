# @chief-clancy/core

## 0.2.0

### Minor Changes

- [#302](https://github.com/Pushedskydiver/chief-clancy/pull/302) [`c2ee440`](https://github.com/Pushedskydiver/chief-clancy/commit/c2ee440d2486333c7ba0073fc110122c6c29f9d6) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - **Breaking:** tighten `package.json` `exports` to four namespaced subdirectory wildcards.

  The top-level `./*.js` wildcard export has been replaced with four explicit subpaths:
  - `./types/*.js`
  - `./schemas/*.js`
  - `./shared/*.js`
  - `./board/*.js`

  Consumers may import from the package root (`@chief-clancy/core`) or any of the four subpaths above. Top-level deep imports like `@chief-clancy/core/foo.js` are no longer resolvable.

  This is a breaking change under pre-1.0 semver — bumping `0.1.2 → 0.2.0`. The published 0.1.x range accidentally exposed every file under `dist/` via the top-level `./*.js` wildcard; 0.2.0 restricts the surface to the four intentional namespaces. In-repo consumers (`@chief-clancy/terminal`, `@chief-clancy/dev`) were already using the four subpaths exclusively; the narrowing makes the public API surface explicit for published consumers.

  See `packages/core/README.md` for the full deep-import policy.

## 0.1.2

### Patch Changes

- [#286](https://github.com/Pushedskydiver/chief-clancy/pull/286) [`404a224`](https://github.com/Pushedskydiver/chief-clancy/commit/404a2240e157ae0d61e627dedcd656551eda0ed6) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add `--from` support to the implement pipeline for local plan execution.

  **dev (minor):** Plan file parser (`parsePlanFile`, `checkApprovalStatus`, `toSyntheticTicket`), local-mode infrastructure (no-op board, synthetic config, local preflight), pipeline wiring for `--from`, directory listing with natural sort (`listPlanFiles`), and public API exports for all plan-file utilities.

  **terminal (patch):** Batch runner (`runImplementBatch`) for `--from {directory} --afk`, implement entry point with directory detection and `--afk` dispatch, workflow and command docs for batch mode, e2e tests for local plan pipeline and lifecycle contracts.

  **plan (patch):** README updated — replaced deferred `implement-from` text with shipped `--from` usage docs pointing at `chief-clancy` and `/clancy:implement`.

  **chief-clancy, core, brief, scan (patch):** README consistency pass — standardised monorepo link ordering (dependency-first), section naming, early-stage warning, and `--from` mentions where applicable.

## 0.1.1

### Patch Changes

- [#260](https://github.com/Pushedskydiver/chief-clancy/pull/260) [`fb22c36`](https://github.com/Pushedskydiver/chief-clancy/commit/fb22c36bc4d3ace684ea8f8dfee00364e7c9c137) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Initial public release of @chief-clancy/dev — autonomous ticket executor with readiness gate, AFK loop, and structured artifact reporting. All package READMEs standardised with consistent monorepo section, credits, and license. Terminal bumped to pick up dev 0.1.0 dependency.
