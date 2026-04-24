---
status: Shipped
date: 2026-03-23
revised: 2026-04-10
---

# Package Evolution Strategy

## Decision

Ship v1 with two packages (`core` + `terminal`) but organise the code internally around future package boundaries. Extract into separate packages when a real consumer proves the need.

## Target package map

| Package                  | Purpose                                                          | Audience                            | Board needed?  |
| ------------------------ | ---------------------------------------------------------------- | ----------------------------------- | -------------- |
| `@chief-clancy/cli`      | Interactive wizard — "what do you need?"                         | Everyone                            | No             |
| `@chief-clancy/core`     | Domain model, types, schemas, board APIs                         | Library consumers                   | N/A            |
| `@chief-clancy/dev`      | Pipeline orchestration, lifecycle modules                        | Automators                          | Yes            |
| `@chief-clancy/brief`    | Grill → decompose → produce brief document                       | PMs, designers, founders, engineers | No             |
| `@chief-clancy/plan`     | Read brief/ticket → produce implementation plan                  | Tech leads, engineers               | No             |
| `@chief-clancy/scan`     | Static-analysis tooling for codebase mapping                     | Planners, agents                    | No             |
| `@chief-clancy/design`   | Design specs, a11y, Stitch integration, visual verification      | Designers, frontend engineers       | No             |
| `@chief-clancy/terminal` | Full install — consumes all above + hooks, runners, all commands | Engineers using the full pipeline   | Yes            |
| `@chief-clancy/chat`     | Slack/Teams conversational interface                             | Teams wanting chat-driven workflows | Depends on use |
| `chief-clancy`           | Unscoped alias → terminal                                        | Existing users, quick install       | Yes            |

## Dependency direction

```
scan        (zero runtime deps — markdown/asset-only)

core        (domain model, types, schemas, board APIs, shared utilities)

brief    ← scan                 (prompt + markdown installer; scan is workspace-asset-only, zero code imports)
plan     ← scan                 (prompt + markdown installer; scan is workspace-asset-only, zero code imports)
design                          (future — scope TBD)
dev      ← core, scan           (pipeline, lifecycle, executor — imports core; scan is workspace-asset-only, zero code imports)

terminal ← core, dev            (installer + hooks + runners)
chief-clancy ← terminal, brief, plan, scan  (CLI wrapper; delegates to terminal's runInstall, passes brief + plan + scan asset paths)
chat                            (future — sibling to terminal, not a chain)
cli                             (future — interactive install wizard)
```

Terminal and chat are **siblings**, not a chain — both consume core + dev directly. The "light-dep-on-core" shape originally planned for brief/plan/design did not materialise: brief and plan shipped as prompt+markdown installers (scan is what they needed for codebase-reading agents, not core types), and design's shape is deferred until Phase F.

## Extraction criteria

Extract a directory into its own package when **any** of these are true:

1. **A second consumer exists.** Another package (e.g. `chat`) needs the capability without the rest.
2. **The directory exceeds 2000 lines.** It has grown into a substantial body of code.
3. **Independent release cadence.** The capability changes at a different rate than the rest.

When extracting:

1. Move the source directory to `packages/{name}/src/`
2. Add package.json, tsconfig, vitest config
3. Update imports across the monorepo
4. Add boundary rule in ESLint
5. Update turbo.json, knip.json

## Standalone packages own their slash commands

**Rule (locked 2026-04-09):** standalone packages own all of their slash commands — including approval gates — when the only runtime dependency the command needs is board credentials in `.clancy/.env`. The package does not have to wait for the full pipeline to ship its full lifecycle surface.

**Plan, brief, and dev all follow this rule.** Each package ships its full standalone+board lifecycle as a self-contained surface:

- **`@chief-clancy/plan`** ships `/clancy:plan`, `/clancy:approve-plan`, and `/clancy:board-setup` (+ `/clancy:update-plan` and `/clancy:uninstall-plan` for lifecycle management). Approval writes a `.clancy/plans/{stem}.approved` SHA-256 marker, and in standalone+board mode `/clancy:approve-plan` can optionally push the approved plan to the source board ticket as a comment — see [`packages/plan/src/workflows/approve-plan.md`](../../packages/plan/src/workflows/approve-plan.md) Step 4c. The push uses the same six per-platform curl blocks already documented in `plan.md` Step 5b for the original board comment post.
- **`@chief-clancy/brief`** ships `/clancy:brief`, `/clancy:approve-brief`, and `/clancy:board-setup` (+ `/clancy:update-brief` and `/clancy:uninstall-brief` for lifecycle management). Approval walks the brief's decomposition table and creates child tickets on the board (in topological order) with a single-source-of-truth pipeline label rule — see [`packages/brief/src/workflows/approve-brief.md`](../../packages/brief/src/workflows/approve-brief.md) Step 6. Standalone+board users have no `CLANCY_ROLES` configured but the workflow defaults to `CLANCY_LABEL_PLAN` because they have clearly intended to use plan — the standalone+board case in the precedence list explicitly handles this without needing a role gate.
- **`@chief-clancy/dev`** ships `/clancy:dev`, `/clancy:dev-loop`, and `/clancy:board-setup` (+ `/clancy:update-dev` and `/clancy:uninstall-dev` for lifecycle management). Dev needs board credentials to fetch tickets for autonomous execution via `/clancy:dev` and to drive the AFK queue via `/clancy:dev-loop`. Board-setup is adapted from brief (same credential collection, same `.clancy/.env` output) with dev-specific text. Local-mode execution (without board credentials) runs through dev's pipeline — dev exposes the `--from <plan>` / `fromPath` + `localTicketSeed` infrastructure — but the user-facing surface lives in `@chief-clancy/terminal` as `/clancy:implement --from <plan>`, not as a dev-owned slash command.

All three packages use the same `.clancy/.env` and `.clancy/clancy-implement.js` env-var probes in their Step 1 preflight to classify into three install contexts (standalone / standalone+board / terminal). In standalone mode, brief hard-stops on `/clancy:approve-brief` (there is nothing to do without a board, since approve-brief's job is to create tickets on the board) while plan continues with the local marker path (it can write a `.approved` SHA without a board).

**What's NOT in scope under this rule:** code-applying tooling. A slash command that reads a plan file and writes code (the originally-scoped `/clancy:implement-from`) does NOT belong in the plan package, even though it would also be prompt-only. The cohesion test is "is this part of the package's lifecycle, or is it downstream consumption of the package's output?" Planning produces plans; executing the plan is downstream consumption and lives in `@chief-clancy/dev`. The lesson — that package-scope decisions need both layering AND cohesion lenses, and that the cohesion test alone is what kept `/clancy:implement-from` out of the plan package even though layering would have allowed it — surfaced when PR #213 was opened, reviewed, and then closed without merging in favour of deferring `/clancy:implement-from` to `dev`. The closed PR is preserved at [#213](https://github.com/Pushedskydiver/chief-clancy/pull/213) as the reference implementation for whoever ships `/clancy:implement-from` in `dev`.

## Local-ticket schema

Preserved here for forward-compatibility: if and when a future release ships local-source tickets (stored as markdown files in `.clancy/tickets/`), this is the intended shape. If that release ships with a different schema, the release's own decision doc supersedes this section.

**Path:** `.clancy/tickets/<id>-<slug>.md` (e.g. `.clancy/tickets/0042-add-credential-guard-hook.md`). Sequential numeric ids survive renames; the slug is for human readability.

**Frontmatter (Clancy-native, not Backlog.md-compatible):**

```yaml
---
id: 0042
title: Add credential guard hook to terminal
status: draft|ready|in-progress|done|blocked
type: feature|fix|chore|refactor|docs|test
package: core|terminal|brief|plan|dev|chief-clancy
created: 2026-04-10
priority: low|normal|high
dependencies: [] # array of ticket ids — named "dependencies" to match Backlog.md, GitHub Issues, and Linear (NOT "blocked_by")
acceptance:
  - 'concrete verifiable signal'
estimate_loops: 1 # how many iterations expected; >1 means the ticket should be split
---
```

**Body sections (adopted from [Backlog.md](https://github.com/MrLesk/Backlog.md) conventions verbatim):** `## Description`, `## Acceptance Criteria` with indexed checkboxes (`- [ ] #1`, `- [ ] #2`), `## Implementation Plan`, `## Implementation Notes`, `## Final Summary`. Body conventions follow Backlog.md so a future one-way export to their TUI/Web UI is trivial. Frontmatter does NOT follow Backlog.md because their schema is closed (their writer rebuilds frontmatter from a fixed TypeScript interface, dropping unknown fields on round-trip) and has no first-class slot for `package` or our `type` taxonomy. Backlog.md also lacks bidirectional sync to remote boards, so the "free future sync" benefit of adopting their format is hypothetical.

## Move-first-improve-second discipline

Structural refactors that move code across package boundaries, rename files, or flatten directory layouts ship under a strict discipline:

1. **Pure `git mv` + import rewrites only.** Every moved file shows `similarity index 100%` in `git log --stat -M`; files touched in-place (barrel `index.ts`, consumer imports) contain only import-path rewrites. No logic changes, no style changes, no renames beyond the move itself, no test changes beyond import paths.
2. **PR description includes a NOTICED list** — bulleted improvement opportunities spotted during the move, with `file:line` references. Zero fixes in the move PR itself.
3. **Separate improvement PRs land after the corresponding move chain completes.** Each improvement PR targets ONE cluster (one lifecycle module, one helper, etc) for reviewability. Improvement PRs are numbered `Nx.1`, `Nx.2`, etc.
4. **Improvement PRs evaluate against current standards.** Per [`docs/RATIONALIZATIONS.md`](../RATIONALIZATIONS.md) "The existing code does it this way, so it's fine" entry, do not let "but the old code did it this way" gatekeep the improvements.
5. **NOTICED items that don't ship as improvement PRs** carry forward into `PROGRESS.md` as deferred improvements so they don't get forgotten.

This discipline is grounded in seven-PR precedent from the core → dev/lifecycle refactor (commits `f8cd61f`, `46ba20a`, `0fa2ba1`, `8c49a26`, `6edc40e`, `02c4fc6`, `6aa9af9` — every file showed `similarity index 100%`). It implements [`docs/DEVELOPMENT.md`](../DEVELOPMENT.md) "NOTICED BUT NOT TOUCHING" and [`docs/RATIONALIZATIONS.md`](../RATIONALIZATIONS.md) "I'll quickly clean up this adjacent code" as a hard rule for any structural refactor.

## Original context (2026-03-23)

The original decision was to ship v1 with two packages (core + terminal) and organise code internally by future package boundaries. That decision was correct — the rebuild completed successfully with this structure. Internal boundaries (enforced by eslint-plugin-boundaries) remain in place; extraction is mechanical because import rules are already enforced.
