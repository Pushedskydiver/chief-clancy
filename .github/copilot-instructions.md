# Copilot Instructions — Clancy Monorepo

Autonomous, board-driven development for Claude Code. Monorepo for `@chief-clancy/*` packages.

## Project overview

Clancy is a CLI tool installed via `npx chief-clancy`. It scaffolds slash commands, hooks, and board integrations (Jira, GitHub Issues, Linear, Shortcut, Notion, Azure DevOps) into Claude Code projects. This monorepo splits the codebase into `@chief-clancy/core` (board intelligence, types, lifecycle, pipeline), `@chief-clancy/terminal` (installer, hooks, CLI bridge), `@chief-clancy/brief` (standalone strategic brief generator), `@chief-clancy/plan` (standalone implementation planner), `@chief-clancy/dev` (standalone autonomous ticket executor), and `@chief-clancy/scan` (codebase scanning agents). The `chief-clancy` wrapper delegates to terminal and sources brief + plan content from their respective packages.

## Tech stack

- **Language:** TypeScript (ESM, strict mode, `verbatimModuleSyntax`)
- **Runtime:** Node 24+ (LTS)
- **Package manager:** pnpm workspaces + Turborepo
- **Build:** `tsc` per package (core builds first via `^build` dependency)
- **Test:** Vitest (workspace projects, co-located unit tests + integration tests)
- **Lint:** ESLint flat config (`defineConfig`) + Prettier
- **Validation:** `zod/mini` for all runtime validation of external data
- **Versioning:** `@changesets/cli` (independent versioning)
- **Quality:** knip (dead code), publint (package validation), attw (type resolution)

## Architecture rules

- **Core imports nothing from terminal, brief, plan, or chat** — enforced by eslint-plugin-boundaries
- **Brief and plan are fully standalone** — no imports from core, terminal, or chat
- **Terminal imports from core only** — no cross-imports with brief, plan, or chat
- **Dependency direction:** core ← terminal ← chief-clancy wrapper. Brief and plan are standalone (no core/terminal deps)
- **Brief and plan have three installation modes:** standalone (no board), standalone+board (credentials via `/clancy:board-setup`), terminal (full pipeline via `npx chief-clancy`). Detection uses `.clancy/.env` + `.clancy/clancy-implement.js` presence

## Code conventions

- **File naming:** kebab-case (`git-ops.ts`, `env-schema.ts`)
- **Test co-location:** `<name>/<name>.ts` + `<name>/<name>.test.ts`
- **Imports:** Use `~/` path alias for local imports, `@chief-clancy/core` for cross-package
- **Types:** No `any` — use `unknown` + type narrowing. Prefer `type` over `interface`.
- **Prefer annotations and `satisfies` over `as`.** `as const` is fine. `as unknown as X` is almost always wrong in production.
- **Error handling:** Hooks and notifications are best-effort (never throw)
- **Expected failures return Result-shaped discriminated unions** (`{ ok: true, ...data } | { ok: false, error: { kind, ...context } }`), not thrown exceptions — see [CONVENTIONS.md §Error Handling](../docs/CONVENTIONS.md#error-handling).
- **Security:** Use `execFileSync` (argument arrays), never `execSync` with string interpolation
- **Pure functions by default.** Side effects isolated to boundary functions.
- **No `reduce()`.** Use `.map()/.filter()` or explicit functions.
- **Max 3 chained method calls.** Beyond 3, assign to named variables. Inline callbacks must be short — extract longer logic into a named function.
- **No bare function references in array callbacks.** Always wrap: `.map((x) => fn(x))`. Type-guard predicates and built-in constructors (e.g. `Boolean`, `Number`) are exempt. Enforced by `unicorn/no-array-callback-reference`.
- **Name compound boolean conditions.** `const isDoubleQuoted = ...` then `if (isDoubleQuoted || isSingleQuoted)`.
- **Boolean naming: `is*/has*/can*/should*` prefix.** Variables and predicate functions.
- **No nested ternaries.** Ever.
- **TSDoc on package public API only** (see [CONVENTIONS.md §Code Style](../docs/CONVENTIONS.md#code-style) — Rule 11). Covers `src/index.ts` + `core/src/{types,schemas,shared,board}/` wildcard subtrees. Internal functions: no TSDoc unless the WHY is non-obvious. Explicit return types on exported functions. TSDoc immediately above its export, no blank line between.
- **Options objects for 4+ parameters.** (ESLint `max-params: 3`.)
- **Co-locate types with their module.** Only move to `types/` when used by 2+ modules.
- **Co-locate helpers with their module.** Extract to `shared/` only when used by 2+ modules.
- **Beat spacing in function bodies.** Separate distinct concerns with one blank line. Guard + early return = one unit. Single-purpose functions need no internal blank lines. No walls of unbroken code; no staccato every-other-line spacing.
- **`eslint-disable` is a last resort.** Look for simpler alternatives first (e.g. `.forEach()` + named function instead of `for...of`).
- **Cross-platform paths:** Use `node:path` join, never string concatenation. Support Windows.
- **Symlink guards:** Use `lstatSync` with ENOENT-only catch, not `existsSync` + `lstatSync` (dangling symlink bypass).
- **Internal modules don't use `index.ts` barrels.** Import direct source files (e.g. `./foo.js`). Only the package-level `src/index.ts` uses this pattern. Post-Barrier-Core, `core`'s wildcard-exposed subtrees (`./types/*.js`, `./schemas/*.js`, `./shared/*.js`, `./board/*.js`) contain no barrel `index.ts` files — only declaration files. See [CONVENTIONS.md §Folder Structure](../docs/CONVENTIONS.md#folder-structure) for the five-category model.

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

Code is organised by **capability directories** that map to future packages. See `docs/decisions/PACKAGE-EVOLUTION.md` for the full extraction plan.

### Core (domain model + capabilities)

| Path                         | Purpose                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| `packages/core/src/board/`   | Board type, factory, 6 implementations                             |
| `packages/core/src/types/`   | Shared type definitions                                            |
| `packages/core/src/schemas/` | Zod validation schemas                                             |
| `packages/core/src/shared/`  | Pure utilities (cache, env-parser, git-ops, git-token, http, etc.) |

### Dev (autonomous execution)

| Path                          | Purpose                                                           |
| ----------------------------- | ----------------------------------------------------------------- |
| `packages/dev/src/lifecycle/` | Ticket lifecycle (branch, deliver, rework, PR creation, progress) |
| `packages/dev/src/pipeline/`  | Phase orchestration (context, run-pipeline, 13 phases)            |

### Brief (standalone brief generator)

| Path                            | Purpose                                                           |
| ------------------------------- | ----------------------------------------------------------------- |
| `packages/brief/src/commands/`  | Slash commands (`brief.md`, `approve-brief.md`, `board-setup.md`) |
| `packages/brief/src/workflows/` | Workflows (`brief.md`, `approve-brief.md`, `board-setup.md`)      |
| `packages/brief/src/agents/`    | Agent prompts (`devils-advocate.md`)                              |
| `packages/brief/src/installer/` | Self-contained installer module (no core/terminal deps)           |
| `packages/brief/bin/brief.js`   | CLI entry point for `npx @chief-clancy/brief`                     |

### Plan (standalone implementation planner)

| Path                           | Purpose                                                         |
| ------------------------------ | --------------------------------------------------------------- |
| `packages/plan/src/commands/`  | Slash commands (`plan.md`, `approve-plan.md`, `board-setup.md`) |
| `packages/plan/src/workflows/` | Workflows (`plan.md`, `approve-plan.md`, `board-setup.md`)      |
| `packages/plan/src/installer/` | Self-contained installer module (no core/terminal deps)         |
| `packages/plan/bin/plan.js`    | CLI entry point for `npx @chief-clancy/plan`                    |

### Terminal (CLI + automation)

| Path                               | Future package | Purpose                                                                             |
| ---------------------------------- | -------------- | ----------------------------------------------------------------------------------- |
| `packages/terminal/src/installer/` | terminal       | Installer modules                                                                   |
| `packages/terminal/src/roles/`     | terminal       | 3 on-disk roles (implementer, reviewer, setup) — planner and strategist are virtual |
| `packages/terminal/src/agents/`    | terminal       | 7 agent prompts                                                                     |
| `packages/terminal/src/shared/`    | terminal       | Terminal utilities (ansi, prompt, notify)                                           |
| `packages/terminal/src/hooks/`     | terminal       | Pre-built CommonJS hooks                                                            |

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
