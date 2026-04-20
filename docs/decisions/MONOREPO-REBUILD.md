# Brief: Monorepo — `@chief-clancy` workspace

**Status:** Shipped
**Type:** Architecture
**Date:** 2026-03-23

---

## Problem

Clancy was a single npm package (`chief-clancy`) that bundled board intelligence, ticket lifecycle, slash commands, hooks, and agent prompts into one artifact. Internal module structure had grown organically with no formal public-API boundary.

Three consequences:

1. **No reuse path.** Other consumers (MCP server, chat interface) needed board intelligence without terminal machinery. That meant importing the whole package or duplicating logic.
2. **No enforced architecture.** Nothing prevented a board module from importing a CLI utility, or a phase from reaching into the installer. Dependencies were implicit.
3. **Accumulated debt.** 22 point releases of feature work left some modules in shape where a rewrite was cheaper than continued patching.

## Proposed solution

Build a fresh monorepo from scratch. Set up all tooling, standards, and infrastructure before writing any application code. Then bring modules over from the existing Clancy codebase one at a time, rewriting where quality or clarity could improve.

This was not a migration — it was a rebuild with the old codebase as reference material. Every module either carried over (if it met the new standards) or was rewritten (if it could be simpler, clearer, or better structured).

## Packages

| Workspace               | npm name                 | Status                                                                                |
| ----------------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| `packages/core`         | `@chief-clancy/core`     | Shipped — board APIs, schemas, shared types, ticket lifecycle primitives              |
| `packages/terminal`     | `@chief-clancy/terminal` | Shipped — installer, slash commands, hooks, AFK runner, Claude CLI bridge             |
| `packages/brief`        | `@chief-clancy/brief`    | Shipped — standalone grill → decompose → brief                                        |
| `packages/plan`         | `@chief-clancy/plan`     | Shipped — standalone brief/ticket → plan + approve-plan gate                          |
| `packages/dev`          | `@chief-clancy/dev`      | Shipped — pipeline orchestration, lifecycle modules, AFK executor                     |
| `packages/scan`         | `@chief-clancy/scan`     | Shipped — static-analysis tooling for codebase mapping                                |
| `packages/chief-clancy` | `chief-clancy`           | Shipped — thin bin wrapper (`npx chief-clancy` delegates to `@chief-clancy/terminal`) |
| `packages/cli`          | `@chief-clancy/cli`      | Future — interactive install wizard                                                   |
| `packages/design`       | `@chief-clancy/design`   | Future (Phase F) — design specs, a11y, Stitch integration                             |
| `packages/chat`         | `@chief-clancy/chat`     | Future — MCP server / Slack / Teams conversational interface                          |

## What Clancy gains

- Clean, enforced architecture — dependency direction is a lint rule, not a convention
- Every module rewritten or validated against strict quality standards
- Public API boundaries between packages
- Foundation for MCP server and chat without duplication
- Consistent `@chief-clancy/*` namespace
- Modern toolchain replacing known-broken npm CI workarounds

## What Clancy loses

- Git blame history (fresh repo)
- PR discussion history (old repo stays archived, not deleted)
- Time that could go to features
- Simplicity of single-package publishing

> **Full target package map** — see [`PACKAGE-EVOLUTION.md`](PACKAGE-EVOLUTION.md). **Phases shipped** — see [PROGRESS.md §Phase ledger](../../PROGRESS.md#phase-ledger). **Live rules** — [`CONVENTIONS.md`](../CONVENTIONS.md), [`DEVELOPMENT.md`](../DEVELOPMENT.md), [`DA-REVIEW.md`](../DA-REVIEW.md), [`SELF-REVIEW.md`](../SELF-REVIEW.md), [`TESTING.md`](../TESTING.md).
