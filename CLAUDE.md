# Clancy Monorepo — Project Guide

Autonomous, board-driven development for Claude Code. Monorepo for `@chief-clancy/*` packages.

## Packages

| Workspace | npm name | Purpose |
|---|---|---|
| `packages/core` | `@chief-clancy/core` | Board intelligence, schemas, types, ticket lifecycle, phase pipeline, shared utilities |
| `packages/terminal` | `@chief-clancy/terminal` | Installer, slash commands, hooks, AFK runner, agents, Claude CLI bridge |
| `packages/chief-clancy` | `chief-clancy` | Thin bin wrapper — `npx chief-clancy` delegates to terminal |
| `packages/chat` | `@chief-clancy/chat` | Future — MCP server, Chat SDK bot |

## Key paths

| Path | Purpose |
|---|---|
| `packages/core/src/board/` | Board type, factory, 6 implementations (jira, github, linear, shortcut, notion, azdo) |
| `packages/core/src/lifecycle/` | Ticket lifecycle modules (fetch-ticket, deliver, rework, pr-creation, lock, cost, resume, quality) |
| `packages/core/src/pipeline/` | Phase pipeline (13 pure phases, context) |
| `packages/core/src/schemas/` | Zod validation (env, board APIs) |
| `packages/core/src/types/` | Shared type definitions (board, remote) |
| `packages/core/src/shared/` | Pure utilities (git-ops, env-parser, branch, progress, format, remote, http, feasibility, pull-request) |
| `packages/terminal/src/installer/` | Installer modules (file-ops, hook-installer, manifest, prompts, UI) |
| `packages/terminal/src/roles/` | 5 roles — slash commands and workflows |
| `packages/terminal/src/afk/` | AFK runner + session reports |
| `packages/terminal/src/agents/` | 7 agent prompts |
| `packages/terminal/src/templates/` | CLAUDE.md template for user projects |
| `packages/terminal/src/shared/` | Terminal-specific utilities (claude-cli, prompt, notify, ansi) |
| `packages/terminal/hooks/` | 9 pre-built CommonJS hooks |
| `docs/` | Project documentation |
| `docs/decisions/` | Design decisions organised by version |

## Key documentation

| Doc | Purpose |
|---|---|
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Code quality standards, complexity limits, functional rules, import ordering |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Development process — phase validation, session pattern, DA reviews |
| [docs/GIT.md](docs/GIT.md) | Branch strategy, commit format, merge conventions |
| [docs/GLOSSARY.md](docs/GLOSSARY.md) | Ubiquitous language — term definitions |
| [docs/decisions/](docs/decisions/) | Design decisions by version |
| [PROGRESS.md](PROGRESS.md) | Current phase and PR status |

## Commands

```bash
# Root — runs across all packages via Turborepo
pnpm build              # Build all packages (core first, then terminal)
pnpm test               # Run all tests
pnpm lint               # Lint all packages
pnpm typecheck          # Type-check all packages
pnpm format             # Format with Prettier
pnpm format:check       # Check formatting

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
4. TDD: write tests → implement → lint → review
5. DA review of completed PR
6. Mark PR complete in PROGRESS.md

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
