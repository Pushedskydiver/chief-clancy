---
status: Approved (revised 2026-04-01)
date: 2026-03-23
revised: 2026-04-01
---

# Package Evolution Strategy

## Decision

Ship v1 with two packages (`core` + `terminal`) but organise the code internally around future package boundaries. Extract into separate packages when a real consumer proves the need.

## Revision (2026-04-01)

The original plan (9 packages extracted from core/terminal) has been refined based on session 48 learnings. Key changes:

1. **Standalone capability packages** — `brief`, `plan`, and `design` earn standalone status not because terminal needs them extracted, but because they serve non-developer audiences (designers, PMs, founders) who don't need the full pipeline.
2. **QA stays in the pipeline** — the verification gate and quality metrics are tightly coupled to the implement/deliver loop. No standalone audience.
3. **`@chief-clancy/cli` as discovery wizard** — interactive package selector under the org scope. `chief-clancy` (unscoped) stays as a quick alias to terminal.
4. **Chat as a sibling to terminal** — both consume core/dev/brief/plan directly. Not a chain.

## Target package map

| Package                  | Purpose                                                          | Audience                            | Board needed?  |
| ------------------------ | ---------------------------------------------------------------- | ----------------------------------- | -------------- |
| `@chief-clancy/cli`      | Interactive wizard — "what do you need?"                         | Everyone                            | No             |
| `@chief-clancy/core`     | Domain model, types, schemas, board APIs                         | Library consumers                   | N/A            |
| `@chief-clancy/dev`      | Pipeline orchestration, lifecycle modules                        | Automators                          | Yes            |
| `@chief-clancy/brief`    | Grill → decompose → produce brief document                       | PMs, designers, founders, engineers | No             |
| `@chief-clancy/plan`     | Read brief/ticket → produce implementation plan                  | Tech leads, engineers               | No             |
| `@chief-clancy/design`   | Design specs, a11y, Stitch integration, visual verification      | Designers, frontend engineers       | No             |
| `@chief-clancy/terminal` | Full install — consumes all above + hooks, runners, all commands | Engineers using the full pipeline   | Yes            |
| `@chief-clancy/chat`     | Slack/Teams conversational interface                             | Teams wanting chat-driven workflows | Depends on use |
| `chief-clancy`           | Unscoped alias → terminal                                        | Existing users, quick install       | Yes            |

## Dependency direction

```
core
├── brief   (light dep — types/schemas only)
├── plan    (light dep — types/schemas only)
├── design  (light dep — types/schemas only)
├── dev     (heavy dep — board APIs, pipeline, lifecycle)
│
terminal    (consumes all above + adds installer/hooks/runners)
chat        (consumes all above + adds Slack/Teams adapter)
│
cli         (interactive wizard — installs other packages)
```

Terminal and chat are **siblings**, not a chain. Both wire their own I/O into core/dev.

## Standalone packages (brief, plan, design)

Each standalone package ships:

- A Claude Code slash command (markdown prompt)
- A lightweight installer (`npx @chief-clancy/brief` → copies commands to `.claude/commands/clancy/`)
- Minimal supporting code (file I/O for storing documents)

Each standalone package does NOT need:

- Hooks
- Runtime bundles
- Board configuration or `.clancy/.env`
- The pipeline

### Why standalone?

These capabilities serve audiences beyond developers:

- **Brief** — a designer structuring a feature idea, a PM writing a spec, a founder validating a concept
- **Plan** — a tech lead breaking down a project, a team planning a sprint
- **Design** — a designer writing component specs, accessibility requirements

They work with just Claude Code and a project directory. No board, no pipeline, no config.

### Conflict resolution

Multiple packages may install the same slash command (e.g. both `brief` and `terminal` ship `/clancy:brief`). This is handled by:

1. **Idempotent file writes** — slash commands are markdown files in `.claude/commands/clancy/`. Writing the same file twice is a no-op.
2. **Terminal is a superset** — it includes all standalone commands plus hooks/runners/board config. Installing terminal over brief just adds the extra pieces.
3. **Uninstall is clean** — removing terminal leaves standalone commands intact if the standalone package is still installed.

## What stays in terminal (not extracted)

- **QA** — verification gate (Stop hook) and quality metrics are pipeline-coupled. No standalone audience.
- **Hooks** — tightly bound to Claude Code's hook system. No other consumer.
- **Runners** — implement and autopilot entry points. Only terminal and chat consume these.
- **Installer** — the install/update/uninstall lifecycle.

## Extraction criteria (unchanged)

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

## Build order

1. **`@chief-clancy/brief`** — prove the standalone installer pattern works
2. **`@chief-clancy/plan`** — same pattern as brief
3. **`@chief-clancy/design`** — same pattern, but needs Stitch integration work
4. **`@chief-clancy/dev`** — extract when chat arrives as a second consumer
5. **`@chief-clancy/cli`** — interactive wizard, built after standalone packages exist
6. **`@chief-clancy/chat`** — conversational interface, the big new capability

## Standalone packages own their slash commands

**Rule (locked Phase C, 2026-04-09):** standalone packages own all of their slash commands — including approval gates — when the only runtime dependency the command needs is board credentials in `.clancy/.env`. The package does not have to wait for the full pipeline to ship its full lifecycle surface.

**Concrete example (Phase C, plan):** `@chief-clancy/plan` ships `/clancy:plan`, `/clancy:approve-plan`, and `/clancy:board-setup` as a single self-contained surface. Approval (write a `.clancy/plans/{stem}.approved` SHA-256 marker) is part of planning lifecycle — it lives in the plan package alongside the planning command itself, not in the terminal pipeline. In standalone+board mode, `/clancy:approve-plan` can also push the approved plan to the source board ticket as a comment, gated on board credentials being present — see [`packages/plan/src/workflows/approve-plan.md`](../../../packages/plan/src/workflows/approve-plan.md) Step 4c. The push uses the same six per-platform curl blocks already documented in `plan.md` Step 5b for the original board comment post — no new transport surface, no new TS runtime code, no `runPipeline` import.

**Phase D extends the same rule to brief.** `@chief-clancy/brief` will absorb `/clancy:approve-brief` from terminal's strategist directory (PR 11a/11b/12). After Phase D the asymmetry is gone: brief and plan both own their full standalone+board lifecycle.

**What's NOT in scope under this rule:** code-applying tooling. A slash command that reads a plan file and writes code (the originally-scoped `/clancy:implement-from`) does NOT belong in the plan package, even though it would also be prompt-only. The cohesion test is "is this part of the package's lifecycle, or is it downstream consumption of the package's output?" Planning produces plans; executing the plan is downstream consumption and lives in `@chief-clancy/dev` (extracted when chat becomes the second consumer per the `dev` extraction line in the build order above). The lesson — that package-scope decisions need both layering AND cohesion lenses, and that the cohesion test alone is what kept `/clancy:implement-from` out of the plan package even though layering would have allowed it — surfaced during Phase C planning when PR 8 was opened, reviewed, and then closed without merging in favour of deferring `/clancy:implement-from` to `dev`. The closed PR is preserved at [#213](https://github.com/Pushedskydiver/chief-clancy/pull/213) as the reference implementation for whoever ships `dev`.

## Original context (2026-03-23)

The original decision was to ship v1 with two packages (core + terminal) and organise code internally by future package boundaries. That decision was correct — the rebuild completed successfully with this structure.

The evolution above builds on that foundation. Internal boundaries (enforced by eslint-plugin-boundaries) remain in place. Extraction is mechanical because import rules are already enforced.
