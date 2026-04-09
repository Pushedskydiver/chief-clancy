# @chief-clancy/brief

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
