# Code Conventions

Standards enforced across the `@chief-clancy` monorepo. All rules are configured in the root ESLint and Prettier configs.

**Last reviewed:** 2026-03-23

---

## Complexity Limits (ESLint)

| Rule                           | Limit                      | Rationale                                                                        |
| ------------------------------ | -------------------------- | -------------------------------------------------------------------------------- |
| `complexity` (cyclomatic)      | 10                         | NIST standard. Forces extraction of complex logic.                               |
| `sonarjs/cognitive-complexity` | 15                         | Penalises nesting over flat branching. More forgiving for early-return patterns. |
| `max-lines-per-function`       | 50 (skip blanks/comments)  | Forces decomposition. If a function needs 51 lines, it's doing two things.       |
| `max-lines` (per file)         | 300 (skip blanks/comments) | Keeps modules focused.                                                           |
| `max-params`                   | 3                          | Forces options objects. Self-documenting call sites.                             |
| `max-depth`                    | 3                          | No deep nesting. Forces early returns and extraction.                            |

---

## Functional Rules (eslint-plugin-functional)

| Rule                   | Setting                                        | Notes                                                                         |
| ---------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| `no-let`               | error                                          | `const` everywhere. Disable per-line where genuinely needed.                  |
| `immutable-data`       | error (ignoreImmediateMutation, ignoreClasses) | No `obj.foo = bar`, no `arr.push()`. Spread/concat. Test files exempt.        |
| `prefer-readonly-type` | warn (allowLocalMutation)                      | Function params marked readonly. Gradual adoption.                            |
| `no-loop-statements`   | warn                                           | Prefer `.map()/.filter()`. Disable for orchestration where loops are clearer. |

---

## Architecture Enforcement (eslint-plugin-boundaries)

| Rule                                       | Effect   |
| ------------------------------------------ | -------- |
| Core imports nothing from terminal or chat | Enforced |
| Terminal imports from core only            | Enforced |
| Chat imports from core only                | Enforced |
| No cross-imports between terminal and chat | Enforced |

---

## Import Ordering (@ianvs/prettier-plugin-sort-imports)

Imports are sorted into 5 groups, separated by blank lines:

| Group                 | Pattern                             | Example                                            |
| --------------------- | ----------------------------------- | -------------------------------------------------- |
| 1. Type imports       | `import type { ... }` from anywhere | `import type { Board } from '@chief-clancy/core'`  |
| 2. Node built-ins     | `node:*`                            | `import { resolve } from 'node:path'`              |
| 3. Third-party        | npm packages                        | `import { z } from 'zod/mini'`                     |
| 4. Workspace packages | `@chief-clancy/*`                   | `import { createBoard } from '@chief-clancy/core'` |
| 5. Local              | `~/`, `./`, `../`                   | `import { parse } from '~/branch/branch.js'`       |

The `~/` path alias resolves to `./src/*` within each package (configured per-package in `tsconfig.json`). Prefer `~/` for imports that would otherwise need deep relative paths (`../../`). Short relative paths (`./`, `../`) are fine.

Enforced on save and pre-commit via Prettier. Zero manual effort after setup.

---

## Code Style

- **No `reduce()`.** Use `.map()/.filter()` chains or explicit simple functions. Readability over cleverness.
- **Max 3 chained method calls.** Beyond 3, assign intermediate results to named variables. Inline callbacks in chains must be short (1–2 lines) — extract longer logic into a named function and pass it in.
- **No long ternaries.** If it doesn't fit on one line, use `if/else` or extract a function.
- **No nested ternaries.** Ever.
- **JSDoc on all exported functions.** Description, `@param` for each parameter, `@returns`. Not on internal helpers where types make it obvious.
- **Explicit return types on exported functions.** TypeScript inference is for internal code, not public API.
- **No `any`.** Use `unknown` + type narrowing. `as` casts only where structurally justified with a comment explaining why.
- **Pure functions by default.** Side effects (HTTP, git, filesystem) isolated to boundary functions. Pure logic extracted into separate functions that take data in and return data out.
- **Dependency injection via function parameters** for I/O. Pass `fetch`, pass `exec` — don't import live implementations in pure logic modules.
- **Options objects for 3+ parameters.** Named properties, self-documenting call sites.
- **Max one level of function nesting.** No functions defined inside functions defined inside functions.
- **`type` over `interface`.** Use `type` by default. Only use `interface` when you need declaration merging or `extends` for object hierarchies. Consistency over convention — one fewer decision to make.
- **Co-locate types with their module.** Types used by a single module live in that module's file. Types used across multiple modules go in `types/`. Types start local and only migrate when there's actual reuse.
- **Name compound boolean conditions.** Extract multi-part conditions into named `const` variables (e.g. `const isDoubleQuoted = first === '"' && last === '"'`). The `if` statement should read like prose.

---

## Testing Standards

- **Co-located tests** — `<name>/<name>.test.ts` next to source.
- **Unit tests for every exported function** — no exceptions.
- **Property-based tests** (fast-check) for parsers, serialisers, URL builders, string transformers.
- **Integration tests** for cross-module workflows (MSW-backed, in `packages/terminal/test/integration/`).
- **Coverage threshold: 80%** per package (statements, branches, functions, lines).
- **Tracer bullet TDD for new logic.** Vertical slices, not horizontal. One test → implement to pass → next test → repeat → refactor. Never write all tests first then all implementation — tests written in bulk test imagined behaviour, not actual behaviour.
- **Tests exempt from functional rules** — `immutable-data` off, `max-lines-per-function` off, `no-duplicate-string` off in test files.

---

## Naming Conventions

- **Files:** kebab-case (`fetch-ticket.ts`, `env-parser.ts`)
- **Directories:** kebab-case (`git-ops/`, `pull-request/`)
- **Types/Interfaces:** PascalCase (`Board`, `FetchedTicket`, `RunContext`)
- **Functions:** camelCase (`createBoard`, `fetchAndParse`)
- **Constants:** UPPER_SNAKE_CASE for env vars and status values (`CLANCY_BASE_BRANCH`, `PR_CREATED`)
- **Barrel exports:** `index.ts` in each module directory, re-exports public API

---

## When to adjust rules

If a lint rule creates unreadable workarounds in practice, flag it. Rules can be tuned based on real experience. Don't suppress warnings silently — discuss and adjust the config.

**`eslint-disable` is a last resort.** Before suppressing a rule, look for a simpler alternative. For example, `for...of` loops can usually be replaced with `.forEach()` and a named function. Only disable when no simple alternative exists and the workaround would be worse than the suppression.
