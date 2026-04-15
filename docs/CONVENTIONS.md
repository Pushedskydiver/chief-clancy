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
- **No long ternaries.** If it doesn't fit on one line, early-return when one branch is empty or extract a function. When both branches are plain values (no call, no `await`), a multi-line ternary assigned to a named `const` is acceptable.
- **Don't hoist a call out of its guard.** A call gated behind a ternary branch runs only on that branch. Hoisting it to a `const` above the ternary evaluates it unconditionally — changing semantics whenever the call has side effects, can throw, or is expensive.
- **No nested ternaries.** Ever.
- **TSDoc on package public API only.** Public API = symbols exported from a path declared in `package.json` `exports` (today: the `src/index.ts` in library-publishing packages — `core`, `terminal`, `brief`, `plan`, `dev` — plus paths under `core/src/{types,schemas,shared,board}/` reachable via the wildcard subpaths). Bin-only packages (`chief-clancy`) and content-only packages (`scan`) don't expose a library surface; no TSDoc rule applies. TSDoc must add semantics beyond the signature: units, invariants, error conditions, edge-case behaviour, cross-function contracts, or _why_ the symbol exists.
  - **Migration is deferred.** Existing JSDoc stays until the file is touched for other reasons. **When editing any function in a covered file, bring that function's TSDoc up to spec. Don't refactor TSDoc you aren't otherwise changing.** New code follows the rule immediately.
  - **Deep path aliases are not themselves a public-API signal.** `~/d/foo.js` is an internal ergonomic; a file reachable _only_ via `~/…` aliases (with no `package.json` `exports` entry) is internal. Files reachable via both an alias and the exports map (e.g. every path under `core/`'s wildcard subtrees) ARE public API — the exports map is the definition of record regardless of how a consumer chooses to import.
  - **Declaration site, not re-export site.** When a symbol is declared internally and re-exported, TSDoc lives on the source declaration. **Trace through re-exports to the original declaration file (the file with the `function`/`type`/`const` keyword). Intermediate barrels — including nested barrels that re-export from other barrels — carry no TSDoc.** This holds even when a barrel file is itself wildcard-exposed; the exports-map public-API scope applies, but the TSDoc location is always the original declaration.
  - **Exported symbols only.** Private helpers in the same file don't inherit the requirement.
  - **Internal functions:** no TSDoc unless the WHY is non-obvious.
  - **Delete TSDoc that restates the signature** (`@param name - The name`).
  - **Immediately above the export.** No blank line between TSDoc and the `export` keyword it documents.
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
- **Aliasing colliding cross-board names.** When multiple boards export the same name (e.g. `fetchBlockerStatus`), alias at the import site (`import { fetchBlockerStatus as fetchGitHubBlockerStatus }`) or rename the source export. Don't route collisions through a shared barrel — package-entry (`src/index.ts`) and wildcard-exposed `index.ts` barrels exist for package-boundary exports, not collision resolution.
- **Board label helpers stay internal.** `ensureLabel`, `addLabel`, `removeLabel`, `createLabel`, `fetchLabels`, `getStoryLabelIds` are per-provider internals. Don't re-export them from any board barrel.
- **Export for testability is allowed.** When a pure function needs direct unit testing (e.g. `parseCostsLog`, `checkStopCondition`, `parseTime`), export it from the source file. For internal modules, the file-level export _is_ the consumer-visible surface — don't add a barrel just for tests. Package-entry `src/index.ts` and wildcard-exposed `index.ts` barrels remain the package-boundary surface and are unaffected by this rule.

---

## Folder Structure

A **concept folder** (one that groups source code by domain concept, not by build-system role) exists for one of two reasons:

- **Wrapper folder** — a single concept has **≥2 source files** (tests don't count). Examples: `lifecycle/rework/` (`rework.ts` + `rework-builders.ts` + `rework-handlers.ts`), `runner/implement/` (`implement.ts` + `batch.ts`).
- **Grouping folder** — multiple related concepts clustered by a name the team actually uses (Evans, _Domain-Driven Design_, ubiquitous language). Examples: `lifecycle/pull-request/` (per-provider adapters), `pipeline/phases/`.

Single-file concepts stay flat. No `feature-name/feature-name.ts` wrappers — the wrapper folder adds a directory level without adding information.

Build-system or runtime-contract folders (e.g. `src/entrypoints/`) are a separate category — see the **Boundary folder** row in the barrels table below.

### Barrels (`index.ts`)

Five categories cover every `index.ts` across the monorepo; only the first row describes a live category today — wildcard-exposed boundary barrels no longer exist after Barrier-Core flattened `core/`'s. Single-impl wrapper rows are also zero today (Barrier flattened dev/terminal; Barrier-Core flattened core). Both categories are kept as names for what future refactors must not re-introduce.

| Category                           | Where it lives                                                                                                                                                                                                                       | Status                                                                                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package entry** (`src/index.ts`) | Library-publishing packages only — `core`, `terminal`, `brief`, `plan`, `dev`. Bin-only (`chief-clancy`) and content-only (`scan`) packages don't have one.                                                                          | **Kept where it exists.** Defines `package.json` `"."` export; cross-package consumers import from here.                                                                      |
| **Wildcard-exposed boundary**      | `index.ts` barrels that live under a subpath-pattern export subtree in `package.json`. Zero today — post-Barrier-Core, `core/` exposes its subtrees via direct-file wildcards (`./types/*.js` etc.) with no barrel `index.ts` files. | **Semver-locked when present.** Non-barrel files under a wildcard subtree are public (see [Rule 11](#code-style)); this table classifies `index.ts` only, and there are none. |
| **Multi-content folder**           | A folder that already holds multiple concepts (e.g. `lifecycle/pull-request/` — `github.ts` + `gitlab.ts` + `azdo.ts` + `pr-body.ts`).                                                                                               | **No barrel.** Consumers import direct files (`~/d/lifecycle/pull-request/github.js`).                                                                                        |
| **Single-impl wrapper**            | Folder that wraps a single source file.                                                                                                                                                                                              | **Flattened** — folder removed, file lifted to parent.                                                                                                                        |
| **Boundary folder**                | Serves a build-system or runtime contract independent of conceptual clustering (e.g. `src/entrypoints/` — esbuild entry points, main-guard pattern, DI adapter assembly).                                                            | **Kept.** Name and existence are a build-system contract; rules in §Entrypoints govern the contract.                                                                          |

Consumers within a package use deep paths (`~/d/dep-factory/invoke-phase.js`). Cross-package consumers use the package entry (`@chief-clancy/dev`) — no deep-path cross-package imports are possible for `dev`/`terminal` because they declare only `"."` in their `exports` map. `core/` additionally exposes deep paths via its wildcard subpaths.

### Migration state — `core/`

**Barrier-Core landed in `@chief-clancy/core@1.0.0`.** All internal `index.ts` barrels under `src/{types,schemas,shared,board}/` have been deleted; all consumers import from declaration files directly. New `core/` files follow Rule 7 (flat-first, single-file concepts stay flat, **no new internal barrels under `src/{types,schemas,shared,board}/`**). The package-entry `src/index.ts` is the only barrel that remains, and it re-exports per declaration file, not via intermediate barrels.

### Mode is an adapter, not a phase

Local-vs-remote (or any mode axis) is an adapter boundary, not a top-level folder split. Adapters live in their own named folder alongside feature folders (Cockburn, _Hexagonal Architecture_).

### `shared/` discipline

`shared/` holds utilities imported by **2+ sibling folders** with no clearer home. If contents cluster into a concern, they earn their own folder. No `utils/` junk drawers.

---

## Entrypoints

`src/entrypoints/` is a boundary folder (see Folder Structure, above); rules below govern its runtime-surface contract.

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
- **Cache via `Cached<T>` class.** No module-level `let` for caches. Use the `Cached` class from `~/c/shared/cache.js`. Invalidate by passing a `refresh` flag to the fetch function, not by storing sentinel values.
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

## Error Handling

**Return a `Result`-shaped discriminated union for expected failures; `throw` for broken invariants.** `Result` here names a _shape_, not an exported type — there is no shared `Result<T, E>` alias today; each site declares the union inline (a shared alias can land when two or more consumers want to import it). TypeScript has no checked exceptions — a signature that can throw gives no type-level signal. Return-typed failures make failure visible at call sites.

### Rules

- **Return a `Result`-shaped discriminated union** for expected domain failures — not found, unauthorised, validation fail, parse error, network failure, conflict; anything the caller should meaningfully handle.
- **`throw` only for:**
  - Programmer bugs / invariant violations — impossible states, exhaustiveness failures, contract violations. Fail fast, loudly.
  - Unrecoverable conditions — out-of-memory, corrupted state; anywhere the caller's only sensible response is to crash.
- **Pick ONE Result shape and enforce it.** House shape: `{ ok: true, ...data } | { ok: false, error: { kind: '<tag>', ...context } }`. The `error` channel is a tagged discriminated union, not a bare string. No mixing with `{ success, ... }` or library types.
- **Default to an opaque-unknown kind for uncategorised failures.** Recommended shape: `{ kind: 'unknown'; message: string; cause?: unknown }`. No shared type alias today; introduce one the first time two or more call-sites want to import it. Ergonomically close to a string but on a typed chassis — widening later adds a variant; it never devolves into string parsing.
- **Don't design the taxonomy upfront.** New sites start with `kind: 'unknown'`. Promote to a named variant (`kind: 'not-found'`, `kind: 'validation'`, `kind: 'network'`) the first time a caller wants to branch on category — not before.
- **Don't wrap `throw` in a `Result` shape defensively.** A function that genuinely cannot fail in its domain should return `T`, not an `{ ok: true }` union with no reachable failure. Result plumbing without a real failure channel is noise.

### Current-shape baseline and migration

The codebase today uses `{ ok: false, error: string }` in many sites — `packages/core/src/types/remote.ts` and the looser `PingResult` (`packages/core/src/types/board.ts:52`, `{ ok: boolean; error?: string }`) consumed by every board adapter's ping. Pipeline phases in `packages/dev/src/pipeline/` vary today (`error`, `reason`, or bare `ok` on failure). One outlier `{ success: false, error: { message } }` lives in `packages/core/src/board/detect-board.ts:33`. **New code uses the tagged-union shape above; existing sites migrate opportunistically when touched.** No forced-march refactor.

---

## Naming Conventions

- **Files:** kebab-case (`fetch-ticket.ts`, `env-parser.ts`)
- **Directories:** kebab-case (`git-ops/`, `pull-request/`)
- **Types/Interfaces:** PascalCase (`Board`, `FetchedTicket`, `RunContext`)
- **Functions:** camelCase (`createBoard`, `fetchAndParse`)
- **Constants:** UPPER_SNAKE_CASE for env vars and status values (`CLANCY_BASE_BRANCH`, `PR_CREATED`)

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
