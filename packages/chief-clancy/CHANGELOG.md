# chief-clancy

## 0.9.21

### Patch Changes

- Updated dependencies [[`b3eb148`](https://github.com/Pushedskydiver/chief-clancy/commit/b3eb148d95217593c3d19e471b3bb2884dfda076)]:
  - @chief-clancy/brief@0.4.1
  - @chief-clancy/plan@0.6.1
  - @chief-clancy/terminal@0.1.13

## 0.9.20

### Patch Changes

- [#273](https://github.com/Pushedskydiver/chief-clancy/pull/273) [`951f908`](https://github.com/Pushedskydiver/chief-clancy/commit/951f90877bc1fc1ac20b9da1c8a4201950adcc3d) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add per-package update commands (`/clancy:update-brief`, `/clancy:update-plan`, `/clancy:update-dev`) and rename terminal's `/clancy:update` to `/clancy:update-terminal` with a thin redirect at the old location.

  Each standalone update workflow: version detection via VERSION marker, npm latest check with 5s timeout, changelog from GitHub releases API (URL-encoded tags), terminal coexistence + standalone package advisories, install mode detection (local/global/both), `--afk` confirmation skip, `npx @latest` cache bypass, post-update verification.

  Uninstall workflows updated to list update files for deletion. Installer file lists and printSuccess output updated across all packages.

- Updated dependencies [[`951f908`](https://github.com/Pushedskydiver/chief-clancy/commit/951f90877bc1fc1ac20b9da1c8a4201950adcc3d)]:
  - @chief-clancy/brief@0.4.0
  - @chief-clancy/plan@0.6.0
  - @chief-clancy/terminal@0.1.12

## 0.9.19

### Patch Changes

- [#267](https://github.com/Pushedskydiver/chief-clancy/pull/267) [`a65c3ee`](https://github.com/Pushedskydiver/chief-clancy/commit/a65c3ee46515b5339f1d1d1e24ed1103e6798e99) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Cross-package uninstall commands. Each standalone package now ships its own uninstall (`/clancy:uninstall-brief`, `/clancy:uninstall-plan`, `/clancy:uninstall-dev`). Terminal's uninstall renamed to `/clancy:uninstall-terminal` with package-aware detection — checks VERSION markers, warns about standalone packages before proceeding, and provides reinstall guidance.

- Updated dependencies [[`a65c3ee`](https://github.com/Pushedskydiver/chief-clancy/commit/a65c3ee46515b5339f1d1d1e24ed1103e6798e99)]:
  - @chief-clancy/brief@0.3.4
  - @chief-clancy/plan@0.5.4
  - @chief-clancy/terminal@0.1.11

## 0.9.18

### Patch Changes

- [#260](https://github.com/Pushedskydiver/chief-clancy/pull/260) [`fb22c36`](https://github.com/Pushedskydiver/chief-clancy/commit/fb22c36bc4d3ace684ea8f8dfee00364e7c9c137) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Initial public release of @chief-clancy/dev — autonomous ticket executor with readiness gate, AFK loop, and structured artifact reporting. All package READMEs standardised with consistent monorepo section, credits, and license. Terminal bumped to pick up dev 0.1.0 dependency.

- Updated dependencies [[`fb22c36`](https://github.com/Pushedskydiver/chief-clancy/commit/fb22c36bc4d3ace684ea8f8dfee00364e7c9c137)]:
  - @chief-clancy/terminal@0.1.10
  - @chief-clancy/brief@0.3.3
  - @chief-clancy/plan@0.5.3
  - @chief-clancy/scan@0.2.2

## 0.9.17

### Patch Changes

- [#248](https://github.com/Pushedskydiver/chief-clancy/pull/248) [`a0c7145`](https://github.com/Pushedskydiver/chief-clancy/commit/a0c71458edc5a38d893ef93e1aa33f4ffea7c368) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add scan README and update all package READMEs with scan references.

- Updated dependencies [[`a0c7145`](https://github.com/Pushedskydiver/chief-clancy/commit/a0c71458edc5a38d893ef93e1aa33f4ffea7c368)]:
  - @chief-clancy/scan@0.2.1
  - @chief-clancy/brief@0.3.2
  - @chief-clancy/plan@0.5.2
  - @chief-clancy/terminal@0.1.9

## 0.9.16

### Patch Changes

- [#246](https://github.com/Pushedskydiver/chief-clancy/pull/246) [`a22f4ad`](https://github.com/Pushedskydiver/chief-clancy/commit/a22f4adbd1df9d08c8777a5165824c21d61be029) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - New `@chief-clancy/scan` package — shared codebase scanning agents and workflows (map-codebase, update-docs) consumed by dev, brief, plan, and terminal. Single source of truth replaces per-package duplicates.

- Updated dependencies [[`a22f4ad`](https://github.com/Pushedskydiver/chief-clancy/commit/a22f4adbd1df9d08c8777a5165824c21d61be029)]:
  - @chief-clancy/scan@0.2.0
  - @chief-clancy/brief@0.3.1
  - @chief-clancy/plan@0.5.1
  - @chief-clancy/terminal@0.1.8

## 0.9.15

### Patch Changes

- Updated dependencies [[`9f27a77`](https://github.com/Pushedskydiver/chief-clancy/commit/9f27a7773e353bfc28482b83249cff36e9771088)]:
  - @chief-clancy/brief@0.3.0

## 0.9.14

### Patch Changes

- Updated dependencies [[`f850376`](https://github.com/Pushedskydiver/chief-clancy/commit/f85037685e1710dbdde86158ecef174cb8df19fc)]:
  - @chief-clancy/brief@0.2.0
  - @chief-clancy/terminal@0.1.7

## 0.9.13

### Patch Changes

- Updated dependencies [[`3cbfcc7`](https://github.com/Pushedskydiver/chief-clancy/commit/3cbfcc72bde32e5986261c70b6ca45934244ada7)]:
  - @chief-clancy/plan@0.5.0

## 0.9.12

### Patch Changes

- Updated dependencies [[`73af800`](https://github.com/Pushedskydiver/chief-clancy/commit/73af800ec19b05fb0033c74a21bab4e2893b5e0f)]:
  - @chief-clancy/plan@0.4.2

## 0.9.11

### Patch Changes

- Updated dependencies [[`1e24a51`](https://github.com/Pushedskydiver/chief-clancy/commit/1e24a5148c9c080a490a2acb12d2bf4a77ea3b1a)]:
  - @chief-clancy/plan@0.4.1

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
