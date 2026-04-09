# @chief-clancy/terminal

## 0.1.7

### Patch Changes

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

## 0.1.6

### Patch Changes

- [#207](https://github.com/Pushedskydiver/chief-clancy/pull/207) [`fc289b6`](https://github.com/Pushedskydiver/chief-clancy/commit/fc289b60e8a15c5dec758f970b19821e5102be7f) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Move `/clancy:approve-plan` (command + workflow) from `@chief-clancy/terminal`'s planner role into `@chief-clancy/plan` as the new single source of truth. Terminal installs (`npx chief-clancy`) now source the same files via the existing `plan-content` installer module — terminal users see no behaviour change. The standalone installer (`npx @chief-clancy/plan`) deliberately does NOT ship `approve-plan.md` yet: the workflow content is currently board-only and would surface as a broken command for plan-standalone users. The next PR makes the workflow standalone-safe (three-state detection + local `.approved` marker) and wires it into the standalone installer at the same time. Workflow content is byte-identical to the previous terminal version.

## 0.1.5

### Patch Changes

- [#198](https://github.com/Pushedskydiver/chief-clancy/pull/198) [`5f8b6ab`](https://github.com/Pushedskydiver/chief-clancy/commit/5f8b6abaf394bc7a950baf98988467431d5295b6) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Initial release of @chief-clancy/plan — standalone implementation planner for Claude Code. Ships /clancy:plan and /clancy:board-setup commands with three-state mode detection. Terminal consumes plan content via plan-content module; wrapper wires plan sources.

## 0.1.4

### Patch Changes

- Fix statusline showing 100% context used at session start by treating remaining_percentage: 0 as uninitialized data.

## 0.1.3

### Patch Changes

- [#182](https://github.com/Pushedskydiver/chief-clancy/pull/182) [`e6f6fef`](https://github.com/Pushedskydiver/chief-clancy/commit/e6f6fefb8593f348f97a424dfa91530a31687947) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Fix hook errors: add required `matcher` field to settings.json hook entries, replace detached child process in check-update with synchronous npm check (5s timeout), and show installed version in the statusline.

## 0.1.2

### Patch Changes

- [#181](https://github.com/Pushedskydiver/chief-clancy/pull/181) [`e6953c8`](https://github.com/Pushedskydiver/chief-clancy/commit/e6953c8475a92317c2e5d2ebbde5ea9f8542f5e6) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Fix PreToolUse hook output format to match Claude Code's hookSpecificOutput envelope. Hooks now return `permissionDecision: "allow"|"deny"` instead of the deprecated `decision: "approve"|"block"` format. Resolves "hook error" messages in Claude Code v2.1.85+.

## 0.1.1

### Patch Changes

- [#179](https://github.com/Pushedskydiver/chief-clancy/pull/179) [`9555ae0`](https://github.com/Pushedskydiver/chief-clancy/commit/9555ae07b8ed92ccef7b56ce3338737e05cbe42b) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add runtime bundles (clancy-implement.js, clancy-autopilot.js) built by esbuild. The installer now copies self-contained ESM scripts to `.clancy/` that can run without npm dependencies.
