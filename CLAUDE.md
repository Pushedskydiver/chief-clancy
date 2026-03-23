# Clancy Monorepo — Project Guide

Autonomous, board-driven development for Claude Code. Monorepo for `@chief-clancy/*` packages.

## Packages

| Workspace               | npm name                 | Purpose                                                                                |
| ----------------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| `packages/core`         | `@chief-clancy/core`     | Board intelligence, schemas, types, ticket lifecycle, phase pipeline, shared utilities |
| `packages/terminal`     | `@chief-clancy/terminal` | Installer, slash commands, hooks, AFK runner, agents, Claude CLI bridge                |
| `packages/chief-clancy` | `chief-clancy`           | Thin bin wrapper — `npx chief-clancy` delegates to terminal                            |

> **Planned:** `packages/chat` (`@chief-clancy/chat`) — MCP server, Chat SDK bot. Not built until demand exists. ESLint boundary rules are pre-configured.

## Key paths

### Core (domain model + capabilities)

| Path                         | Future package | Purpose                                                       |
| ---------------------------- | -------------- | ------------------------------------------------------------- |
| `packages/core/src/board/`   | core (forever) | Board type, factory, 6 implementations                        |
| `packages/core/src/types/`   | core (forever) | Shared type definitions (board, remote)                       |
| `packages/core/src/schemas/` | core (forever) | Zod validation (env, board APIs)                              |
| `packages/core/src/shared/`  | core (forever) | Pure utilities (git-ops, env-parser, branch, format, http...) |
| `packages/core/src/dev/`     | @c-c/dev       | Ticket lifecycle, phase pipeline, delivery orchestration      |
| `packages/core/src/brief/`   | @c-c/brief     | Strategist — grill, decomposition, ticket creation            |
| `packages/core/src/plan/`    | @c-c/plan      | Implementation planning, approval flow                        |
| `packages/core/src/design/`  | @c-c/design    | Design specs, Stitch integration, visual verification         |
| `packages/core/src/qa/`      | @c-c/qa        | Verification gate, self-healing retry, quality metrics        |

### Terminal (CLI + automation)

| Path                               | Future package | Purpose                                           |
| ---------------------------------- | -------------- | ------------------------------------------------- |
| `packages/terminal/src/installer/` | terminal       | Installer modules (file-ops, hooks, manifest, UI) |
| `packages/terminal/src/roles/`     | terminal       | 5 roles — slash commands and workflows            |
| `packages/terminal/src/hooks/`     | terminal       | 9 pre-built CommonJS hooks                        |
| `packages/terminal/src/agents/`    | terminal       | 7 agent prompts                                   |
| `packages/terminal/src/templates/` | terminal       | CLAUDE.md template for user projects              |
| `packages/terminal/src/shared/`    | terminal       | Terminal utilities (ansi, prompt, notify)         |
| `packages/terminal/src/automate/`  | @c-c/automate  | AFK runner, board watcher, quiet hours, reports   |

### Docs

| Path              | Purpose                               |
| ----------------- | ------------------------------------- |
| `docs/`           | Project documentation                 |
| `docs/decisions/` | Design decisions organised by version |

> See [package evolution strategy](docs/decisions/architecture/package-evolution.md) for the full extraction plan and criteria.

## Key documentation

| Doc                                        | Purpose                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Code quality standards, complexity limits, functional rules, import ordering |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Development process — phase validation, session pattern, review gate         |
| [docs/SELF-REVIEW.md](docs/SELF-REVIEW.md) | Self-review checklist — living document, evolves from Copilot findings       |
| [docs/GIT.md](docs/GIT.md)                 | Branch strategy, commit format, merge conventions                            |
| [docs/GLOSSARY.md](docs/GLOSSARY.md)       | Ubiquitous language — term definitions                                       |
| [docs/decisions/](docs/decisions/)         | Design decisions by version                                                  |
| [PROGRESS.md](PROGRESS.md)                 | Current phase and PR status                                                  |

## Commands

```bash
# Root — runs across all packages via Turborepo
pnpm build              # Build all packages (core first, then terminal)
pnpm test               # Run all tests
pnpm lint               # Lint all packages
pnpm typecheck          # Type-check all packages
pnpm format             # Format with Prettier
pnpm format:check       # Check formatting

# Pre-push quality suite (run before every git push — no exceptions)
pnpm test && pnpm lint && pnpm typecheck && pnpm format:check && pnpm knip && pnpm publint && pnpm attw

# Per-package — run from package directory
pnpm test               # Run package tests (vitest)
pnpm build              # Build package
pnpm lint               # Lint package
pnpm typecheck          # Type-check package

# Changesets
pnpm changeset          # Create a changeset
pnpm changeset version  # Apply version bumps
```

## Architecture rules

- **Core imports nothing from terminal or chat** — enforced by eslint-plugin-boundaries
- **Terminal imports from core only** — no cross-imports with chat
- **Chat imports from core only** — no cross-imports with terminal
- **Dependency direction: core ← terminal ← chief-clancy**

## Commit format

This project uses gitmoji + conventional commit type:

```
<gitmoji> <type>(scope): description
```

Examples:

- `✨ feat: add credential guard hook`
- `🐛 fix: construct test values at runtime`
- `📦 chore: scaffold monorepo with pnpm workspaces`

See [docs/GIT.md](docs/GIT.md) for full details.

## Branch strategy

- `main` — production. Tagged releases.
- `feature/`, `fix/`, `chore/` — branch from `main`, PR back to `main`

See [docs/GIT.md](docs/GIT.md) for full rules.

## Development process

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the full process. Summary:

1. Read the brief + PROGRESS.md
2. Run phase validation (if starting a new phase)
3. Pick up the next PR
4. Tracer bullet TDD: one test → implement → next test → repeat → refactor → lint
5. Review gate: DA review → self-review ([checklist](docs/SELF-REVIEW.md)) → fix findings → PR → Copilot review → fix findings
6. Squash merge, mark PR complete in PROGRESS.md

**TDD is vertical slices, not horizontal.** Don't write all tests then all code. One test → implement to pass → next test. See [DEVELOPMENT.md](docs/DEVELOPMENT.md#phase-based-delivery).

**Review gate order is strict:** DA always runs before self-review. See [DEVELOPMENT.md](docs/DEVELOPMENT.md#review-gate--da--self-review--copilot).

**Hand off after 3 PRs, on context compression, or at task boundaries.** Update PROGRESS.md, save decisions to memory, leave a handoff summary. See [DEVELOPMENT.md](docs/DEVELOPMENT.md#when-to-hand-off).

## Code standards

See [docs/CONVENTIONS.md](docs/CONVENTIONS.md) for all rules. Key items:

- Cyclomatic complexity: 10. Cognitive complexity: 15.
- Max 50 lines per function. Max 300 lines per file.
- `const` everywhere (`no-let`). No mutation (`immutable-data`).
- No `any`. Use `unknown` + type narrowing.
- No `reduce()`. No nested ternaries.
- JSDoc on all exported functions. Explicit return types on exports.
- Pure functions by default. Side effects isolated to boundary functions.
- Co-located tests: `<name>/<name>.test.ts`. 80% coverage per package.

## Important technical details

- `zod/mini` for all runtime validation of external data
- Hooks must be CommonJS — best-effort, must never crash
- Runtime scripts are esbuild bundles — self-contained, zero npm dependency
- 6 boards: Jira, GitHub Issues, Linear, Shortcut, Notion, Azure DevOps
- No npm publishing until feature parity. GitHub release tags only.

## Old repo reference

The existing Clancy codebase lives at `~/Desktop/alex/clancy` — READ-ONLY reference. All work happens in this repo. See the [monorepo brief](docs/decisions/monorepo/brief.md) for the full migration plan.
