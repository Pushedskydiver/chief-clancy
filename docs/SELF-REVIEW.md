# Self-Review Checklist

Line-level accuracy check performed after DA review but before creating a PR. Read every changed file (`git diff main...HEAD`) and check for detail-level issues that DA and CodeRabbit miss.

This checklist complements DA-REVIEW.md — DA owns architectural checks (imports, guards, patterns). Self-review owns line-level accuracy (stale values, wrong strings, test isolation, copy-paste errors).

This is a **living document** — when CodeRabbit catches something the self-review should have spotted, add the specific check here immediately. The checklist grows from real mistakes, not hypotheticals.

---

## Code accuracy

- Do comments/JSDoc match what the code actually does? (stale comments are the #1 review catch)
- After renaming a type field, did all JSDoc and comments referencing the old name get updated? (CodeRabbit caught `"optional"` in JSDoc after the field was renamed to `roleKey`)
- Do comments hardcode counts, versions, or phase numbers that will go stale? Use generic language instead
- Are all function parameters used? Remove unused params or use `_prefixed` naming if keeping for API stability
- Do mock/test URLs match the actual production endpoints? (read the production code to verify)
- Do fixture shapes match what the production code expects? (check Zod schemas and actual API calls)

## Type safety (line-level)

- Are `as` casts justified with an inline comment? Could type narrowing (`typeof`, `in`, `Array.isArray`) be used instead?
- After a type guard (`typeof x === 'string'`), is the narrowed variable used correctly downstream?
- Are `??` (nullish coalescing) and `||` (falsy check) used correctly for the intended semantics?

## Test accuracy

- Are all mocks/spies/stubs reset in `afterEach`? Check for shared test state leaking between tests
- Are promises properly awaited in tests? Do async errors surface or get swallowed?
- Do test assertions use exact expected values, not ambiguous substrings? (`.toEqual({ id: '1' })` not `.toContain('1')`)
- Do any imported modules cache global state that could leak between tests? (reset caches in `afterEach`)
- Are `describe`/`it` blocks accidentally duplicated from copy-paste?
- Do test names accurately describe what is being tested? (CodeRabbit caught a test name that didn't match the narrowed assertion)

## Carried-over content

- When bringing files from the old repo, do hardcoded version numbers match the new repo's config? (CodeRabbit caught Node 22+ in role docs when `engines.node` requires >=24.0.0)
- Do markdown code fences open and close with the same number of backticks? (CodeRabbit caught ``` opening with ```` closing — breaks rendering)

## Consistency

- Are constants duplicated across files? (single source of truth — `grep` for the value)
- Are imports unused?
- Was the same fix applied everywhere it's needed? (don't fix helpers but miss test files)
- Do config options extend defaults rather than replacing them?
- Do docs reference files that only exist in memory (`~/.claude/projects/`) but not in the repo? Contributors can't see memory files
- After renaming a config key or constant, are all references updated? (not just the definition)

## Monorepo-specific

- Are cross-package imports using the package name (`@chief-clancy/core`), not relative paths (`../../core/`)?
- Are new exported functions/types added to the package's barrel export (`index.ts`)?
- Does changing a shared type in core break downstream packages? Run `pnpm build` to verify
- Are `workspace:*` dependencies correct? (core has no workspace deps, terminal depends on core)
- Do new modules respect the dependency direction? (core ← terminal ← wrapper)

## Public API surface

- Are new barrel exports genuinely public API, or internal modules that intra-package code consumes via `~/` imports? (installer internals should not be in the package barrel)
- Are options types (`FetchOpts`, `TransitionOpts`) exported? They should stay internal unless consumed outside the file
- Are board-internal label helpers (`createLabel`, `fetchLabels`, `getStoryLabelIds`) leaking through the barrel? (audit caught Shortcut exporting these)
- Does core `index.ts` alias colliding names? (e.g. `transitionIssue` needs `transitionJiraIssue` alias)

## Board patterns

- Are header builders reused? (audit caught Jira `writeLabels` manually constructing auth instead of using `jiraHeaders()`)
- Are all API responses schema-validated? No raw `as` casts on API data without justification
- Is cache invalidation clean? Use `refresh` param, not sentinel values or `as unknown` casts

## Security / robustness (line-level)

- Is `execSync` used with string interpolation? (use `execFileSync` with argument arrays)
- Are test credential values constructed at runtime where needed? (GitHub secret scanner)
- Is `existsSync` followed by a read/write on the same path? That's a TOCTOU race — wrap the read/write in a try/catch instead
- Do catch blocks only swallow expected error codes? (e.g. only ENOENT, not EACCES/EPERM — unexpected filesystem states should fail loud)
- Does metadata/logging accurately reflect what actually happened? If operations can be skipped, track successes and report those, not the input list

## Config inheritance

- Did changing a config file affect other configs that extend it? (e.g. `tsconfig.build.json` extends `tsconfig.json`)
- Did changing a shared ESLint rule affect test file overrides?
