# chief-clancy

## 0.9.10

### Patch Changes

- Updated dependencies [[`5f184ab`](https://github.com/Pushedskydiver/chief-clancy/commit/5f184ab42a7adcec00665a1cc3b4be937785c6bc)]:
  - @chief-clancy/plan@0.4.0

## 0.9.9

### Patch Changes

- Updated dependencies [[`fc289b6`](https://github.com/Pushedskydiver/chief-clancy/commit/fc289b60e8a15c5dec758f970b19821e5102be7f)]:
  - @chief-clancy/plan@0.3.0
  - @chief-clancy/terminal@0.1.6

## 0.9.8

### Patch Changes

- Updated dependencies [[`b1c3c92`](https://github.com/Pushedskydiver/chief-clancy/commit/b1c3c92d34e0679b04920b3482fa3ee904458cd7)]:
  - @chief-clancy/plan@0.2.0

## 0.9.7

### Patch Changes

- [#198](https://github.com/Pushedskydiver/chief-clancy/pull/198) [`5f8b6ab`](https://github.com/Pushedskydiver/chief-clancy/commit/5f8b6abaf394bc7a950baf98988467431d5295b6) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Initial release of @chief-clancy/plan — standalone implementation planner for Claude Code. Ships /clancy:plan and /clancy:board-setup commands with three-state mode detection. Terminal consumes plan content via plan-content module; wrapper wires plan sources.

- Updated dependencies [[`5f8b6ab`](https://github.com/Pushedskydiver/chief-clancy/commit/5f8b6abaf394bc7a950baf98988467431d5295b6)]:
  - @chief-clancy/plan@0.1.0
  - @chief-clancy/terminal@0.1.5

## 0.9.6

### Patch Changes

- Updated dependencies [[`a682f18`](https://github.com/Pushedskydiver/chief-clancy/commit/a682f184a0c95d87a4ebec59cf5f906f2bc7cc59)]:
  - @chief-clancy/brief@0.1.2

## 0.9.5

### Patch Changes

- Fix statusline showing 100% context used at session start by treating remaining_percentage: 0 as uninitialized data.

- Updated dependencies []:
  - @chief-clancy/terminal@0.1.4

## 0.9.4

### Patch Changes

- [#182](https://github.com/Pushedskydiver/chief-clancy/pull/182) [`e6f6fef`](https://github.com/Pushedskydiver/chief-clancy/commit/e6f6fefb8593f348f97a424dfa91530a31687947) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Fix hook errors: add required `matcher` field to settings.json hook entries, replace detached child process in check-update with synchronous npm check (5s timeout), and show installed version in the statusline.

- Updated dependencies [[`e6f6fef`](https://github.com/Pushedskydiver/chief-clancy/commit/e6f6fefb8593f348f97a424dfa91530a31687947)]:
  - @chief-clancy/terminal@0.1.3

## 0.9.3

### Patch Changes

- [#181](https://github.com/Pushedskydiver/chief-clancy/pull/181) [`e6953c8`](https://github.com/Pushedskydiver/chief-clancy/commit/e6953c8475a92317c2e5d2ebbde5ea9f8542f5e6) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Fix PreToolUse hook output format to match Claude Code's hookSpecificOutput envelope. Hooks now return `permissionDecision: "allow"|"deny"` instead of the deprecated `decision: "approve"|"block"` format. Resolves "hook error" messages in Claude Code v2.1.85+.

- Updated dependencies [[`e6953c8`](https://github.com/Pushedskydiver/chief-clancy/commit/e6953c8475a92317c2e5d2ebbde5ea9f8542f5e6)]:
  - @chief-clancy/terminal@0.1.2

## 0.9.2

### Patch Changes

- [#179](https://github.com/Pushedskydiver/chief-clancy/pull/179) [`9555ae0`](https://github.com/Pushedskydiver/chief-clancy/commit/9555ae07b8ed92ccef7b56ce3338737e05cbe42b) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add runtime bundles (clancy-implement.js, clancy-autopilot.js) built by esbuild. The installer now copies self-contained ESM scripts to `.clancy/` that can run without npm dependencies.

- Updated dependencies [[`9555ae0`](https://github.com/Pushedskydiver/chief-clancy/commit/9555ae07b8ed92ccef7b56ce3338737e05cbe42b)]:
  - @chief-clancy/terminal@0.1.1

## 0.9.1

### Patch Changes

- [`af237df`](https://github.com/Pushedskydiver/chief-clancy/commit/af237df7b6a9386cbb5f671ff7906aece8f5726d) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add package READMEs for npm pages
