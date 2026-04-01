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

| Package | Purpose | Audience | Board needed? |
| --- | --- | --- | --- |
| `@chief-clancy/cli` | Interactive wizard — "what do you need?" | Everyone | No |
| `@chief-clancy/core` | Domain model, types, schemas, board APIs | Library consumers | N/A |
| `@chief-clancy/dev` | Pipeline orchestration, lifecycle modules | Automators | Yes |
| `@chief-clancy/brief` | Grill → decompose → produce brief document | PMs, designers, founders, engineers | No |
| `@chief-clancy/plan` | Read brief/ticket → produce implementation plan | Tech leads, engineers | No |
| `@chief-clancy/design` | Design specs, a11y, Stitch integration, visual verification | Designers, frontend engineers | No |
| `@chief-clancy/terminal` | Full install — consumes all above + hooks, runners, all commands | Engineers using the full pipeline | Yes |
| `@chief-clancy/chat` | Slack/Teams conversational interface | Teams wanting chat-driven workflows | Depends on use |
| `chief-clancy` | Unscoped alias → terminal | Existing users, quick install | Yes |

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

## Original context (2026-03-23)

The original decision was to ship v1 with two packages (core + terminal) and organise code internally by future package boundaries. That decision was correct — the rebuild completed successfully with this structure.

The evolution above builds on that foundation. Internal boundaries (enforced by eslint-plugin-boundaries) remain in place. Extraction is mechanical because import rules are already enforced.
