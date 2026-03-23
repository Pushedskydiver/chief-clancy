# Copilot Instructions — Clancy Monorepo

Autonomous, board-driven development for Claude Code. Monorepo for `@chief-clancy/*` packages.

## Project overview

Clancy is a CLI tool installed via `npx chief-clancy`. It scaffolds slash commands, hooks, and board integrations (Jira, GitHub Issues, Linear, Shortcut, Notion, Azure DevOps) into Claude Code projects. This monorepo splits the codebase into `@chief-clancy/core` (board intelligence, types, lifecycle, pipeline) and `@chief-clancy/terminal` (installer, hooks, CLI bridge). The `chief-clancy` wrapper delegates to terminal.

## Tech stack

- **Language:** TypeScript (ESM, strict mode, `verbatimModuleSyntax`)
- **Runtime:** Node 24+ (LTS)
- **Package manager:** pnpm workspaces + Turborepo
- **Build:** `tsc` per package (core builds first via `^build` dependency)
- **Test:** Vitest (workspace projects, co-located unit tests + MSW integration tests)
- **Lint:** ESLint flat config (`defineConfig`) + Prettier
- **Validation:** `zod/mini` for all runtime validation of external data
- **Versioning:** `@changesets/cli` (independent versioning)
- **Quality:** knip (dead code), publint (package validation), attw (type resolution)

## Architecture rules

- **Core imports nothing from terminal or chat** — enforced by eslint-plugin-boundaries
- **Terminal imports from core only** — no cross-imports with chat
- **Dependency direction:** core ← terminal ← chief-clancy wrapper

## Code conventions

- **File naming:** kebab-case (`git-ops.ts`, `env-schema.ts`)
- **Test co-location:** `<name>/<name>.ts` + `<name>/<name>.test.ts`
- **Imports:** Use `~/` path alias for local imports, `@chief-clancy/core` for cross-package
- **Types:** No `any` — use `unknown` + type narrowing. Prefer `type` over `interface`.
- **Error handling:** Hooks and notifications are best-effort (never throw)
- **Security:** Use `execFileSync` (argument arrays), never `execSync` with string interpolation
- **Pure functions by default.** Side effects isolated to boundary functions.
- **No `reduce()`.** Use `.map()/.filter()` or explicit functions.
- **No nested ternaries.** Ever.
- **JSDoc on all exported functions.** Explicit return types on exports.
- **Options objects for 3+ parameters.**

## Complexity limits (enforced by ESLint)

- Cyclomatic complexity: 10
- Cognitive complexity (sonarjs): 15
- Max lines per function: 50 (skip blanks/comments)
- Max lines per file: 300 (skip blanks/comments)
- Max params: 3
- Max nesting depth: 3

## Functional rules (enforced by ESLint)

- `no-let` — `const` everywhere
- `immutable-data` — no mutation, use spread/concat (test files exempt)
- `prefer-readonly-type` — warn, gradual adoption
- `no-loop-statements` — warn, prefer map/filter

## Commit format

Gitmoji + conventional commit type:

```
<gitmoji> <type>(scope): description
```

Examples: `✨ feat:`, `🐛 fix:`, `♻️ refactor:`, `📝 docs:`, `📦 chore:`, `✅ test:`, `💄 style:`

## Branch strategy

- `main` — production, tagged releases
- `feature/`, `fix/`, `chore/` — branch from `main`, squash merge back to `main`

## Key paths

| Path                               | Purpose                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `packages/core/src/board/`         | Board type, factory, 6 implementations                                                                  |
| `packages/core/src/lifecycle/`     | Ticket lifecycle (fetch-ticket, deliver, rework, pr-creation, lock, cost, resume, quality)              |
| `packages/core/src/pipeline/`      | Phase pipeline (phases, context)                                                                        |
| `packages/core/src/schemas/`       | Zod validation schemas                                                                                  |
| `packages/core/src/types/`         | Shared type definitions                                                                                 |
| `packages/core/src/shared/`        | Pure utilities (git-ops, env-parser, branch, progress, format, remote, http, feasibility, pull-request) |
| `packages/terminal/src/installer/` | Installer modules                                                                                       |
| `packages/terminal/src/roles/`     | 5 roles — slash commands and workflows                                                                  |
| `packages/terminal/src/agents/`    | 7 agent prompts                                                                                         |
| `packages/terminal/hooks/`         | Pre-built CommonJS hooks                                                                                |

## Testing

```bash
pnpm test               # All tests via Turborepo
pnpm build              # Build all packages (core first)
pnpm lint               # ESLint all packages
pnpm typecheck          # tsc --noEmit all packages
pnpm format:check       # Prettier check
pnpm knip               # Dead code detection
pnpm publint            # Package.json validation
pnpm attw               # TypeScript resolution check
```

## Key technical details

- 6 boards: Jira, GitHub Issues, Linear, Shortcut, Notion, Azure DevOps
- Hook files must be CommonJS — best-effort, must never crash
- Pipeline labels: `clancy:brief` → `clancy:plan` → `clancy:build` control ticket flow
- PR-based delivery for ALL tickets — parented → epic branch, standalone → base branch
- ESM-only packages (`"type": "module"`)
