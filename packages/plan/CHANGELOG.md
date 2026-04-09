# @chief-clancy/plan

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
