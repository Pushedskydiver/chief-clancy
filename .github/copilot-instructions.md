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
- **Max 3 chained method calls.** Beyond 3, assign to named variables. Inline callbacks must be short — extract longer logic into a named function.
- **Name compound boolean conditions.** `const isDoubleQuoted = ...` then `if (isDoubleQuoted || isSingleQuoted)`.
- **No nested ternaries.** Ever.
- **JSDoc on all exported functions.** Explicit return types on exports. JSDoc must be immediately above its export.
- **Options objects for 3+ parameters.**
- **Co-locate types with their module.** Only move to `types/` when used by 2+ modules.
- **Co-locate helpers with their module.** Extract to `shared/` only when used by 2+ modules.
- **`eslint-disable` is a last resort.** Look for simpler alternatives first (e.g. `.forEach()` + named function instead of `for...of`).
- **Cross-platform paths:** Use `node:path` join, never string concatenation. Support Windows.
- **Symlink guards:** Use `lstatSync` with ENOENT-only catch, not `existsSync` + `lstatSync` (dangling symlink bypass).
- **Internal modules stay out of the package barrel.** Only public API goes in `src/index.ts`.

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

Code is organised by **capability directories** that map to future packages. See `docs/decisions/architecture/package-evolution.md` for the full extraction plan.

### Core (domain model + capabilities)

| Path                               | Future package | Purpose                                                            |
| ---------------------------------- | -------------- | ------------------------------------------------------------------ |
| `packages/core/src/board/`         | core (forever) | Board type, factory, 6 implementations                             |
| `packages/core/src/types/`         | core (forever) | Shared type definitions                                            |
| `packages/core/src/schemas/`       | core (forever) | Zod validation schemas                                             |
| `packages/core/src/shared/`        | core (forever) | Pure utilities (cache, env-parser, git-ops, git-token, http, etc.) |
| `packages/core/src/dev/lifecycle/` | @c-c/dev       | Ticket lifecycle (branch, deliver, rework, PR creation, progress)  |
| `packages/core/src/dev/pipeline/`  | @c-c/dev       | Phase orchestration (context, run-pipeline, 13 phases)             |

### Terminal (CLI + automation)

| Path                               | Future package | Purpose                                   |
| ---------------------------------- | -------------- | ----------------------------------------- |
| `packages/terminal/src/installer/` | terminal       | Installer modules                         |
| `packages/terminal/src/roles/`     | terminal       | 5 roles — slash commands and workflows    |
| `packages/terminal/src/agents/`    | terminal       | 7 agent prompts                           |
| `packages/terminal/src/shared/`    | terminal       | Terminal utilities (ansi, prompt, notify) |
| `packages/terminal/src/hooks/`     | terminal       | Pre-built CommonJS hooks                  |

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
