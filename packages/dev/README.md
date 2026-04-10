# @chief-clancy/dev

Autonomous Ralph Wiggum execution surface for Claude Code — pick up tickets and execute them with judgment, optionally in a loop.

> **Status:** Phase E in progress. This package is currently a private skeleton (`private: true`, version `0.0.0`). It will be published as `@chief-clancy/dev@0.1.0` when the Phase E PR chain completes (see [`docs/decisions/architecture/package-evolution.md`](../../docs/decisions/architecture/package-evolution.md) "Phase E — `@chief-clancy/dev` extraction decisions").

## What it will do (when Phase E completes)

- **`/clancy:dev TICKET-123`** — pick up one ticket from a board, grade it through a 5-check readiness gate (Clear / Testable / Small / Locatable / Touch-bounded), and execute it through the full pipeline (branch → implement → PR).
- **`/clancy:dev --loop --afk`** — autonomous loop. Pre-flight grade all queued tickets, write a readiness report, halt before the loop if any need clarification.
- **`/clancy:dev --loop --afk --afk-strict`** — same, but skip yellows and execute greens only.

## Architecture

A new third package category in the chief-clancy monorepo: **standalone installer + esbuild runtime bundle + slash commands, with no hooks**. Distinct from `@chief-clancy/brief` and `@chief-clancy/plan` (zero-runtime markdown-only standalones) and from `@chief-clancy/terminal` (full installer + hooks + bundles).

`@chief-clancy/dev` sits between `@chief-clancy/core` (which it imports types and shared utilities from) and `@chief-clancy/terminal` (which imports it for the `executeFixedCount` loop primitive after Phase E PR 11b).

See [`docs/decisions/architecture/package-evolution.md`](../../docs/decisions/architecture/package-evolution.md) for the full architectural rationale, including the locked decisions about hybrid package shape, the readiness gate, the spawn-based grader, and the Cut E ticket schema.
