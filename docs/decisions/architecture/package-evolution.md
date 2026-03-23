---
status: Approved
date: 2026-03-23
---

# Package Evolution Strategy

## Decision

Ship v1 with two packages (`core` + `terminal`) but organise the code internally around future package boundaries. Extract into separate packages only when a second consumer proves the need.

## Context

Jamie suggested decomposing Clancy by **capability** rather than **runtime boundary**:

| Future Package           | Capability                                                                       |
| ------------------------ | -------------------------------------------------------------------------------- |
| `@chief-clancy/core`     | Board abstraction, types, schemas, env detection. The domain model.              |
| `@chief-clancy/dev`      | Pick up ticket, branch, build, deliver PR, rework. Epic/single-ticket awareness. |
| `@chief-clancy/brief`    | Take idea → grill → decompose → create tickets on the board.                     |
| `@chief-clancy/plan`     | Implementation planning, TDD plans, approval flow.                               |
| `@chief-clancy/design`   | Design specs, Stitch integration, visual verification.                           |
| `@chief-clancy/qa`       | Verification gate, self-healing retry, code review, quality metrics.             |
| `@chief-clancy/terminal` | CLI installer, hooks, slash commands. Wires capabilities for Claude Code.        |
| `@chief-clancy/automate` | AFK runner, board watcher, quiet hours, session reports.                         |
| `@chief-clancy/chat`     | Teams/Slack/Telegram interface.                                                  |
| `chief-clancy`           | Thin wrapper. `npx chief-clancy` → terminal.                                     |

The dependency chain:

```
core ← dev ← terminal ← automate ← chat
core ← brief ↗
core ← design ↗
core ← plan ↗
core ← qa ↗
```

## Why not extract now

1. **No second consumer.** Separate packages earn their cost when someone wants one capability without the rest. That only happens when `automate` or `chat` arrives.
2. **Overhead.** Each package needs: tsconfig, vitest config, turbo entry, knip config, publint/attw checks, barrel exports, CI steps. 9 packages × that overhead = friction with no payoff.
3. **Internal boundaries are just as enforceable.** eslint-plugin-boundaries can enforce directory-level import rules within a package.

## v1 structure (core + terminal)

Code is organised by future-package directories inside `core` and `terminal`:

```
packages/core/src/
  board/             → stays in core forever (domain model)
  types/             → stays in core forever
  schemas/           → stays in core forever
  shared/            → stays in core forever (pure utilities)

  dev/               → future @chief-clancy/dev
    lifecycle/       →   fetch-ticket, deliver, rework, pr-creation, lock, cost, resume
    pipeline/        →   phases, context, orchestrator

  brief/             → future @chief-clancy/brief
    strategist/      →   grill, decomposition, ticket creation

  plan/              → future @chief-clancy/plan
    planner/         →   implementation plans, approval flow

  design/            → future @chief-clancy/design
    specs/           →   component, a11y, content, layout specs
    stitch/          →   Stitch MCP integration
    verify/          →   Playwright, axe-core, Lighthouse

  qa/                → future @chief-clancy/qa
    verification/    →   gate, self-healing retry
    review/          →   code review, quality metrics

packages/terminal/src/
  installer/         → stays in terminal
  roles/             → stays in terminal (slash commands invoke core capabilities)
  hooks/             → stays in terminal
  shared/            → stays in terminal (ansi, prompt, notify)
  agents/            → stays in terminal
  templates/         → stays in terminal

  automate/          → future @chief-clancy/automate
    afk/             →   AFK runner, board watcher, quiet hours, session reports
```

## Extraction criteria

Extract a directory into its own package when **any** of these are true:

1. **A second consumer exists.** Another package (e.g. `chat`) needs `dev/` without `terminal/`. The consumer is real, not hypothetical.
2. **The directory exceeds 2000 lines.** It has grown into a substantial body of code that benefits from independent versioning and testing.
3. **Independent release cadence.** The capability changes at a different rate than the rest of core — extracting it prevents unnecessary version bumps.

When extracting:

1. Move `core/src/{dir}/` to `packages/{dir}/src/`
2. Add package.json, tsconfig, vitest config
3. Update imports across the monorepo
4. Add boundary rule in ESLint
5. Update turbo.json, knip.json

The extraction is mechanical because internal import boundaries are already enforced.

## What this changes

- **Directory layout** in core gets nested capability directories instead of flat
- **Nothing changes** about the phases, PRs, or execution plan
- **ESLint boundaries** will enforce internal directory rules (dev/ cannot import from brief/, etc.)
- **Architecture docs** document both current state (core + terminal) and target state (full package map)

## What this does NOT change

- v1 ships as two packages: `@chief-clancy/core` + `@chief-clancy/terminal`
- The 14-phase delivery plan stays the same
- npm publishing strategy stays the same
- No new packages are created until extraction criteria are met
