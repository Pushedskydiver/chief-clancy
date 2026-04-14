# Code Conventions

Standards enforced across the `@chief-clancy` monorepo. All rules are configured in the root ESLint and Prettier configs.

See also: [DEVELOPMENT.md "Task sizing"](DEVELOPMENT.md#task-sizing) for the process side of complexity limits, [TESTING.md](TESTING.md) for testing disciplines, [GLOSSARY.md](GLOSSARY.md) for term definitions including [tracer bullet TDD](GLOSSARY.md).

**Last reviewed:** 2026-04-09

---

## Complexity Limits (ESLint)

| Rule                           | Limit                      | Rationale                                                                        |
| ------------------------------ | -------------------------- | -------------------------------------------------------------------------------- |
| `complexity` (cyclomatic)      | 10                         | NIST standard. Forces extraction of complex logic.                               |
| `sonarjs/cognitive-complexity` | 15                         | Penalises nesting over flat branching. More forgiving for early-return patterns. |
| `max-lines-per-function`       | 50 (skip blanks/comments)  | Forces decomposition. If a function needs 51 lines, it's doing two things.       |
| `max-lines` (per file)         | 300 (skip blanks/comments) | Keeps modules focused.                                                           |
| `max-params`                   | 3                          | 3 is the limit. 4+ params must use an options object.                            |
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

| Rule                               | Effect   |
| ---------------------------------- | -------- |
| Core imports nothing from terminal | Enforced |
| Terminal imports from core only    | Enforced |

---

## Import Ordering (@ianvs/prettier-plugin-sort-imports)

Imports are sorted into 5 groups, separated by blank lines:

| Group                 | Pattern                             | Example                                            |
| --------------------- | ----------------------------------- | -------------------------------------------------- |
| 1. Type imports       | `import type { ... }` from anywhere | `import type { Board } from '@chief-clancy/core'`  |
| 2. Node built-ins     | `node:*`                            | `import { resolve } from 'node:path'`              |
| 3. Third-party        | npm packages                        | `import { z } from 'zod/mini'`                     |
| 4. Workspace packages | `@chief-clancy/*`                   | `import { createBoard } from '@chief-clancy/core'` |
| 5. Local              | `~/c/`, `~/t/`, `./`, `../`         | `import { parse } from '~/c/branch/branch.js'`     |

Each package has a unique path alias: `~/c/` for core, `~/t/` for terminal, `~/d/` for dev (configured in each `tsconfig.json`, rewritten by `tsc-alias` at build time). Use the alias for imports that would otherwise need deep relative paths (`../../` or deeper). Short relative paths (`./`, `../`) within the same module are fine.

**Path aliases do not work across package boundaries.** TypeScript's `rootDir` enforcement (TS6059) blocks aliases that resolve outside the package's `src/` directory. Use `@chief-clancy/{package}` imports for cross-package dependencies — never `~/c/` from terminal or `~/d/` from core.

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
- **Options objects for 4+ parameters.** 3 is the ESLint limit. 4+ must use an options object with named properties.
- **Unused parameters:** prefix with `_` (e.g. `_unused`) if keeping for API stability. Otherwise remove.
- **Max one level of function nesting.** No functions defined inside functions defined inside functions.
- **`type` over `interface`.** Use `type` by default. Only use `interface` when you need declaration merging or `extends` for object hierarchies. Consistency over convention — one fewer decision to make.
- **Co-locate types with their module.** Types used by a single module live in that module's file. Types used across multiple modules go in `types/`. Types start local and only migrate when there's actual reuse.
- **Name compound boolean conditions.** Extract multi-part conditions into named `const` variables (e.g. `const isDoubleQuoted = first === '"' && last === '"'`). The `if` statement should read like prose.
- **Co-locate helpers with their module.** Helper functions used by a single module stay in that module's file. Extract to `shared/` only when used by 2+ modules. No premature `utils/` junk drawers.

---

## Export Hygiene

- **Types start internal.** Only add `export` to a type when it's consumed outside the file. Options objects (`FetchOpts`, `TransitionOpts`) used only by the function in the same file stay non-exported.
- **Barrel exports match actual consumers.** If nothing outside the module directory imports a function/type, don't re-export it from `index.ts`. Run `pnpm knip` to catch unused exports before pushing.
- **Core `index.ts` aliases colliding names.** When multiple boards export `fetchBlockerStatus`, alias them in the core barrel: `fetchGitHubBlockerStatus`, `fetchJiraBlockerStatus`, etc.
- **Label internals stay private.** `ensureLabel`, `addLabel`, `removeLabel`, and low-level helpers (`createLabel`, `fetchLabels`, `getStoryLabelIds`) are internal to each board — don't re-export from the board barrel or core index.
- **Export for testability is allowed.** When a pure function needs to be tested directly (e.g., `parseCostsLog`, `checkStopCondition`, `parseTime`), exporting it from the module file is preferred over testing through the public entry point. Keep these exports in the module barrel — they're internal API, not package-level public API.

---

## Entrypoints

Runtime entry points (esbuild bundles) live in `src/entrypoints/`, not alongside the library modules they wire. Both `terminal` and `dev` follow this convention.

- **`src/entrypoints/`** — esbuild entry points that assemble DI adapters from real Node.js APIs and call into library code. These are bundled into self-contained `.js` files copied to the user's `.clancy/` directory.
- **Library modules everywhere else** — `src/runner/`, `src/lifecycle/`, `src/pipeline/`, etc. are imported by entrypoints but never executed directly.
- **Shared adapters** in `src/entrypoints/adapters.ts` (or exported from one entrypoint and imported by another) are inlined at build time — no runtime dependency.
- **Main guard pattern** — every entrypoint ends with a `fileURLToPath(import.meta.url) === resolve(process.argv[1])` check for self-execution.

---

## Board Implementation Patterns

These patterns apply to all board adapters (`board/{provider}/`):

- **Reuse header builders.** Every board has a `{provider}Headers()` function. Always use it — never manually construct auth headers in other functions.
- **Schema-validate all API responses.** Use `fetchAndParse` with a Zod schema, or `.safeParse()` on raw responses. Never use `as` type assertions on API data without a comment justifying why a schema can't be used.
- **Cache via `Cached<T>` class.** No module-level `let` for caches. Use the `Cached` class from `~/c/shared/cache/`. Invalidate by passing a `refresh` flag to the fetch function, not by storing sentinel values.
- **`toFetchedTicket` in each factory.** Maps provider-specific tickets to the normalised `FetchedTicket` shape. Keep the mapping in the factory file, not in the API module.
- **Extract helpers to stay under 50 lines.** Board factories should extract `fetchTickets`, `doTransition`, and `ensureAndAddLabel` as module-level functions above the factory.

---

## Testing Standards

- **Co-located tests** — `<name>/<name>.test.ts` next to source.
- **Unit tests for every exported function** — no exceptions.
- **Property-based tests** (fast-check) for parsers, serialisers, URL builders, string transformers.
- **Integration tests** for cross-module workflows (MSW-backed, in `packages/terminal/test/integration/`).
- **Coverage threshold: 80%** per package (statements, branches, functions, lines).
- **Tracer bullet TDD for new logic.** Vertical slices, not horizontal. One test → implement to pass → next test → repeat → refactor. Never write all tests first then all implementation — tests written in bulk test imagined behaviour, not actual behaviour. See [GLOSSARY.md](GLOSSARY.md) for the definition and [TESTING.md "Writing good tests"](TESTING.md#writing-good-tests) for the supporting disciplines (test state not interactions, mock at boundaries, DAMP > DRY).
- **Tests exempt from functional rules** — `immutable-data` off, `max-lines-per-function` off, `no-duplicate-string` off in test files.

---

## Naming Conventions

- **Files:** kebab-case (`fetch-ticket.ts`, `env-parser.ts`)
- **Directories:** kebab-case (`git-ops/`, `pull-request/`)
- **Types/Interfaces:** PascalCase (`Board`, `FetchedTicket`, `RunContext`)
- **Functions:** camelCase (`createBoard`, `fetchAndParse`)
- **Constants:** UPPER_SNAKE_CASE for env vars and status values (`CLANCY_BASE_BRANCH`, `PR_CREATED`)
- **Module directories:** `feature-name/feature-name.ts` pattern (`env-parser/env-parser.ts`, `file-ops/file-ops.ts`)
- **Barrel exports:** `index.ts` in each module directory, re-exports public API

---

## When to adjust rules

If a lint rule creates unreadable workarounds in practice, flag it. Rules can be tuned based on real experience. Don't suppress warnings silently — discuss and adjust the config.

**`eslint-disable` is a last resort.** Before suppressing a rule, look for a simpler alternative. For example, `for...of` loops can usually be replaced with `.forEach()` and a named function. Only disable when no simple alternative exists and the workaround would be worse than the suppression.

---

## Output style

Selective brevity for chat output, commit messages, and PR comments — adapted from Julius Brussee's [caveman](https://github.com/JuliusBrussee/caveman) patterns and the Brevity Constraints research (Hakim, [arxiv:2604.00025](https://arxiv.org/abs/2604.00025)). The Brevity Constraints paper finds large models can improve accuracy by ~26pp on overthinking-prone tasks (math, scientific reasoning) under brevity constraints, but elaboration-heavy tasks (reading comprehension) get worse. Apply selectively, not universally.

### Where to be terse

- Chat status updates and progress reports
- Commit messages (already enforced by [GIT.md](GIT.md) gitmoji conventions)
- PR comment replies and review feedback summaries
- Plain-prose explanations of what was done

### Where to elaborate (do NOT compress)

- Runtime workflow files (`packages/*/src/{commands,workflows,agents}/*.md`) — reasoning artifacts the agent follows step-by-step
- Decision docs (`docs/decisions/`) — preserve rationale
- Test descriptions and `Caught in:` historical citations — load-bearing for future debugging
- Error messages, security warnings, irreversible action confirmations
- Multi-step sequences where fragment order risks misreading
- Anything inside fenced code blocks

### Rules for terse output

- Drop filler, hedging, pleasantries (`just`, `really`, `basically`, `I'd be happy to`, `of course`)
- Prefer short synonyms (`big` not `extensive`, `fix` not `implement a solution for`)
- Keep code blocks, file paths, version numbers, identifiers EXACT — never paraphrase
- Quote error messages verbatim
- Never use `I/we/now/currently` filler in commit messages
- Never restate filenames the scope label already covers
- Never include AI attribution noise in commit messages or PR bodies (`Generated with Claude Code` footers, `🤖` emojis, "made with AI" tags) — but the `Co-Authored-By:` git trailer is the canonical way to credit AI assistance and SHOULD remain on commits per existing convention

### Rationale

Reasoning accuracy degrades as input length grows ([Levy et al. 2024, arxiv:2402.14848](https://arxiv.org/abs/2402.14848)) and recall is U-shaped over long context ([Liu et al. 2023, arxiv:2307.03172](https://arxiv.org/abs/2307.03172)) — real evidence for conciseness. Per the Brevity Constraints paper, brevity helps SELECTIVELY — universal compression hurts elaboration tasks. Following both: be terse in conversational output, elaborate in reasoning artifacts.
