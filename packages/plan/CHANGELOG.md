# @chief-clancy/plan

## 0.2.0

### Minor Changes

- [#204](https://github.com/Pushedskydiver/chief-clancy/pull/204) [`b1c3c92`](https://github.com/Pushedskydiver/chief-clancy/commit/b1c3c92d34e0679b04920b3482fa3ee904458cd7) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Add `--list` flag to `/clancy:plan` for inventorying local plans. The new Step 8 (Plan Inventory) scans `.clancy/plans/`, parses each plan's header (Brief, Row, Source, Planned), sorts by planned date with deterministic tie-breakers, and prints a status table. `--list` short-circuits at the top of Step 1 — no installation detection, network, or board access required. README adds a local planning workflow walkthrough covering `--from`, row targeting, `--afk`, `--list`, and the `## Feedback` revision loop.

## 0.1.0

### Minor Changes

- [#198](https://github.com/Pushedskydiver/chief-clancy/pull/198) [`5f8b6ab`](https://github.com/Pushedskydiver/chief-clancy/commit/5f8b6abaf394bc7a950baf98988467431d5295b6) Thanks [@Pushedskydiver](https://github.com/Pushedskydiver)! - Initial release of @chief-clancy/plan — standalone implementation planner for Claude Code. Ships /clancy:plan and /clancy:board-setup commands with three-state mode detection. Terminal consumes plan content via plan-content module; wrapper wires plan sources.
