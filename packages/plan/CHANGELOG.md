# @chief-clancy/plan

## 0.7.0

### Minor Changes

- [#279](https://github.com/Pushedskydiver/chief-clancy/pull/279) [`9796262`](https://github.com/Pushedskydiver/chief-clancy/commit/979626235383335cb667cdd59e1242825930402d) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Plan: add devil's advocate agent with Step 4g DA grill, 6-item plan health check, and installer infrastructure

  Brief: improve DA agent with dual-mode operation (grill + health-check), Challenges section, severity levels, Step 8a post-brief invocation, and brief health check preamble

## 0.6.1

### Patch Changes

- [#275](https://github.com/Pushedskydiver/chief-clancy/pull/275) [`b3eb148`](https://github.com/Pushedskydiver/chief-clancy/commit/b3eb148d95217593c3d19e471b3bb2884dfda076) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add "Updating" sections to READMEs for per-package update commands and rename `/clancy:update` to `/clancy:update-terminal` in terminal's Setup commands table.

## 0.6.0

### Minor Changes

- [#273](https://github.com/Pushedskydiver/chief-clancy/pull/273) [`951f908`](https://github.com/Pushedskydiver/chief-clancy/commit/951f90877bc1fc1ac20b9da1c8a4201950adcc3d) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add per-package update commands (`/clancy:update-brief`, `/clancy:update-plan`, `/clancy:update-dev`) and rename terminal's `/clancy:update` to `/clancy:update-terminal` with a thin redirect at the old location.

  Each standalone update workflow: version detection via VERSION marker, npm latest check with 5s timeout, changelog from GitHub releases API (URL-encoded tags), terminal coexistence + standalone package advisories, install mode detection (local/global/both), `--afk` confirmation skip, `npx @latest` cache bypass, post-update verification.

  Uninstall workflows updated to list update files for deletion. Installer file lists and printSuccess output updated across all packages.

## 0.5.4

### Patch Changes

- [#267](https://github.com/Pushedskydiver/chief-clancy/pull/267) [`a65c3ee`](https://github.com/Pushedskydiver/chief-clancy/commit/a65c3ee46515b5339f1d1d1e24ed1103e6798e99) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Cross-package uninstall commands. Each standalone package now ships its own uninstall (`/clancy:uninstall-brief`, `/clancy:uninstall-plan`, `/clancy:uninstall-dev`). Terminal's uninstall renamed to `/clancy:uninstall-terminal` with package-aware detection — checks VERSION markers, warns about standalone packages before proceeding, and provides reinstall guidance.

## 0.5.3

### Patch Changes

- [#260](https://github.com/Pushedskydiver/chief-clancy/pull/260) [`fb22c36`](https://github.com/Pushedskydiver/chief-clancy/commit/fb22c36bc4d3ace684ea8f8dfee00364e7c9c137) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Initial public release of @chief-clancy/dev — autonomous ticket executor with readiness gate, AFK loop, and structured artifact reporting. All package READMEs standardised with consistent monorepo section, credits, and license. Terminal bumped to pick up dev 0.1.0 dependency.

- Updated dependencies [[`fb22c36`](https://github.com/Pushedskydiver/chief-clancy/commit/fb22c36bc4d3ace684ea8f8dfee00364e7c9c137)]:
  - @chief-clancy/scan@0.2.2

## 0.5.2

### Patch Changes

- [#248](https://github.com/Pushedskydiver/chief-clancy/pull/248) [`a0c7145`](https://github.com/Pushedskydiver/chief-clancy/commit/a0c71458edc5a38d893ef93e1aa33f4ffea7c368) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add scan README and update all package READMEs with scan references.

- Updated dependencies [[`a0c7145`](https://github.com/Pushedskydiver/chief-clancy/commit/a0c71458edc5a38d893ef93e1aa33f4ffea7c368)]:
  - @chief-clancy/scan@0.2.1

## 0.5.1

### Patch Changes

- [#246](https://github.com/Pushedskydiver/chief-clancy/pull/246) [`a22f4ad`](https://github.com/Pushedskydiver/chief-clancy/commit/a22f4adbd1df9d08c8777a5165824c21d61be029) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - New `@chief-clancy/scan` package — shared codebase scanning agents and workflows (map-codebase, update-docs) consumed by dev, brief, plan, and terminal. Single source of truth replaces per-package duplicates.

- Updated dependencies [[`a22f4ad`](https://github.com/Pushedskydiver/chief-clancy/commit/a22f4adbd1df9d08c8777a5165824c21d61be029)]:
  - @chief-clancy/scan@0.2.0

## 0.5.0

### Minor Changes

- [#216](https://github.com/Pushedskydiver/chief-clancy/pull/216) [`3cbfcc7`](https://github.com/Pushedskydiver/chief-clancy/commit/3cbfcc72bde32e5986261c70b6ca45934244ada7) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - ✨ feat(plan): optional board push from `/clancy:approve-plan` (Phase C PR 9)

  When approving a local plan-file stem in standalone+board mode (board credentials present alongside a local plan), `/clancy:approve-plan` can now push the approved plan to the source board ticket as a comment. Closes the "I have credentials and I want both modes" UX cliff: get the local marker AND the board comment in one approval.

  New flags:
  - `--push` — skip the interactive `[y/N]` prompt and push immediately. Combined with `--afk`, this is the unattended-automation path. Also the retry path for a previously failed push: `EEXIST + --push` falls through Step 4a's already-approved check and re-attempts the Step 4c push without re-writing the marker.
  - `--ticket KEY` — override the `**Source:**` auto-detect from the plan file with an explicit key. Validated against the configured board's regex (one of six per-platform patterns: Jira `^[A-Z][A-Z0-9]+-\d+$`, GitHub `^#\d+$`, Linear `^[A-Z]+-\d+$`, Azure DevOps `^\d+$`, Shortcut `^\d+$`, Notion `^[0-9a-f]{32}$|^[0-9a-f-]{36}$`) before any push attempt.

  Default interactive prompt is `[y/N]` (default No — never surprise-write to a board). All push failures (HTTP non-2xx, network, timeout, dns, auth) are best-effort: the local marker stays in place, `{stem} | BOARD_PUSH_FAILED | {http_status_or_error_class}` is logged to `.clancy/progress.txt`, and the exact retry command is printed for the user to copy.

  The six platform comment-POST curl blocks are duplicated from `plan.md` Step 5b into `approve-plan.md` Step 4c between drift-prevention anchors — a workflow test byte-compares the two regions and fails on mismatch, so the duplication can never silently diverge.

## 0.4.2

### Patch Changes

- [#214](https://github.com/Pushedskydiver/chief-clancy/pull/214) [`73af800`](https://github.com/Pushedskydiver/chief-clancy/commit/73af800ec19b05fb0033c74a21bab4e2893b5e0f) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Defer the dedicated `/clancy:implement-from` slash command (originally scoped as Phase C PR 8) until `@chief-clancy/dev` is extracted. The plan package's README, `approve-plan.md` workflow, and `plan.md` Step 8 inventory are amended to reflect the deferral — concrete forward-references to `/clancy:implement-from` and "PR 8" are replaced with neutral wording about a future plan-implementing tool, and the success-message hint after `/clancy:approve-plan` now points users at "ask Claude to implement the plan, or run `npx chief-clancy` for the full pipeline" instead of a slash command that does not exist.

  **Why:** the in-flight PR 8 implementation surfaced a cohesion concern. The plan package is supposed to _create_ plans, not _execute_ them — a slash command that reads a plan file and writes code is downstream consumption of planning output, not planning itself. A second-pass architectural review confirmed that:
  - The original "layering" framing was overstated. PR 8's design was prompt-only (no heavy deps), so it didn't violate the documented `core ← terminal ← chief-clancy` direction. Both placements were technically legal
  - The cohesion concern is real but the slash command is **convenience, not capability** — Claude Code can already do the SHA-256 gate + structured plan parse via natural-language instruction
  - The documented natural home for code-applying tooling is `@chief-clancy/dev`, deferred until chat becomes a second consumer (see `docs/decisions/architecture/package-evolution.md` line ~114)
  - Moving to terminal as `/clancy:implement --from` was considered and rejected — pays README + roadmap + decision-log churn now AND has to move again when `dev` lands. Worst of all worlds

  **What ships unchanged:** PR 7b's `.clancy/plans/{stem}.approved` marker format. The two-line `sha256={hex}\napproved_at={ISO 8601}\n` body is preserved so the eventual `dev` consumer can plug in without re-approving every existing plan. The format is also human-readable for ad-hoc verification (a user or Claude Code can read the marker, hash the plan file, and refuse to apply on mismatch).

  **What's deferred alongside PR 8:** the Step 8 inventory's fourth state (`Implemented`), originally PR 8.1 — wiring a reader for `LOCAL_IMPLEMENT` entries that no command writes is dead code until the consumer ships. Inventory continues to show three states: `Planned`, `Approved`, `Stale (re-approve)`.

  **What's unaffected:** PR 9 (standalone+board push from approve-plan) and PR 10 (Phase C cleanup + docs sync) still ship as planned. Phase D's PR 11a/11b/12 (brief absorbs approve-brief) is also unaffected — approval is planning lifecycle (the gate between draft and ready), not execution, so the approve-\* moves stand on their own framing.

  Closes [#213](https://github.com/Pushedskydiver/chief-clancy/issues/213) (the original PR 8 implementation, closed without merging).

## 0.4.1

### Patch Changes

- [#211](https://github.com/Pushedskydiver/chief-clancy/pull/211) [`1e24a51`](https://github.com/Pushedskydiver/chief-clancy/commit/1e24a5148c9c080a490a2acb12d2bf4a77ea3b1a) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - `/clancy:plan --list` (Step 8 inventory) now shows live Approved/Stale status from the sibling `.approved` markers PR 7b writes. The Status column reads `.clancy/plans/{plan-id}.approved`, parses its `sha256=` line, hashes the current plan file the same way `/clancy:approve-plan` does, and reports one of three states:
  - `Planned` — no marker exists yet
  - `Approved` — marker exists and its `sha256` matches the current plan file
  - `Stale (re-approve)` — marker exists but its `sha256` differs from the current plan file (the plan was edited after approval)

  The inventory display switches from a column-aligned space-delimited layout to a pipe-delimited table so multi-word Status values like `Stale (re-approve)` are unambiguous to scan and parse. The footer hint now points at `/clancy:approve-plan` (which lives in the plan package after PR 7a/7b) instead of the previous "install the full pipeline" advice. The fourth state `Implemented` lands in PR 8.

## 0.4.0

### Minor Changes

- [#209](https://github.com/Pushedskydiver/chief-clancy/pull/209) [`5f184ab`](https://github.com/Pushedskydiver/chief-clancy/commit/5f184ab42a7adcec00665a1cc3b4be937785c6bc) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - `/clancy:approve-plan` is now standalone-aware. Three-state Step 1 preflight detects standalone / standalone+board / terminal mode. Step 2 is a dual-mode resolver: in standalone mode the argument must be a plan-file stem (e.g. `add-dark-mode-2`); in standalone+board / terminal modes a plan-file lookup runs first, then ticket-key validation, with plan stems winning on collision.

  New Step 4a writes a `.clancy/plans/{stem}.approved` marker via race-safe `O_EXCL` exclusive create. The marker body is two `key=value` lines:

  ```
  sha256={hex sha256 of the plan file at approval time}
  approved_at={ISO 8601 UTC timestamp}
  ```

  The SHA-256 is the gate the upcoming `/clancy:implement-from` command checks before applying changes — drift between the marker's `sha256` and the current plan file's hash blocks implementation until re-approval. New Step 4b updates the source brief file's marker comment from `<!-- planned:1,2 -->` to `<!-- approved:1 planned:1,2 -->` (best-effort — failure does not roll back the local marker).

  The standalone installer (`npx @chief-clancy/plan`) now ships `approve-plan.md` alongside `plan.md` and `board-setup.md` (deferred from PR 7a until the workflow was standalone-safe). Terminal users see no behaviour change — the existing 970-line board transport flow (Steps 5, 5b, 6) is preserved entirely for ticket-key inputs in terminal and standalone+board modes.

## 0.3.0

### Minor Changes

- [#207](https://github.com/Pushedskydiver/chief-clancy/pull/207) [`fc289b6`](https://github.com/Pushedskydiver/chief-clancy/commit/fc289b60e8a15c5dec758f970b19821e5102be7f) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Move `/clancy:approve-plan` (command + workflow) from `@chief-clancy/terminal`'s planner role into `@chief-clancy/plan` as the new single source of truth. Terminal installs (`npx chief-clancy`) now source the same files via the existing `plan-content` installer module — terminal users see no behaviour change. The standalone installer (`npx @chief-clancy/plan`) deliberately does NOT ship `approve-plan.md` yet: the workflow content is currently board-only and would surface as a broken command for plan-standalone users. The next PR makes the workflow standalone-safe (three-state detection + local `.approved` marker) and wires it into the standalone installer at the same time. Workflow content is byte-identical to the previous terminal version.

## 0.2.0

### Minor Changes

- [#204](https://github.com/Pushedskydiver/chief-clancy/pull/204) [`b1c3c92`](https://github.com/Pushedskydiver/chief-clancy/commit/b1c3c92d34e0679b04920b3482fa3ee904458cd7) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add `--list` flag to `/clancy:plan` for inventorying local plans. The new Step 8 (Plan Inventory) scans `.clancy/plans/`, parses each plan's header (Brief, Row, Source, Planned), sorts by planned date with deterministic tie-breakers, and prints a status table. `--list` short-circuits at the top of Step 1 — no installation detection, network, or board access required. README adds a local planning workflow walkthrough covering `--from`, row targeting, `--afk`, `--list`, and the `## Feedback` revision loop.

## 0.1.0

### Minor Changes

- [#198](https://github.com/Pushedskydiver/chief-clancy/pull/198) [`5f8b6ab`](https://github.com/Pushedskydiver/chief-clancy/commit/5f8b6abaf394bc7a950baf98988467431d5295b6) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Initial release of @chief-clancy/plan — standalone implementation planner for Claude Code. Ships /clancy:plan and /clancy:board-setup commands with three-state mode detection. Terminal consumes plan content via plan-content module; wrapper wires plan sources.
