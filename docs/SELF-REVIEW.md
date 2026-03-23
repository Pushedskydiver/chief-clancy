# Self-Review Checklist

Line-level accuracy check performed after DA review but before creating a PR. Read every changed file (`git diff main...HEAD`) and check for detail-level issues that DA and Copilot miss.

This is a **living document** — when Copilot catches something the self-review should have spotted, add the specific check here immediately. The checklist grows from real mistakes, not hypotheticals.

---

## Code accuracy

- Do comments/JSDoc match what the code actually does? (stale comments are the #1 review catch)
- After renaming a type field, did all JSDoc and comments referencing the old name get updated? (Copilot caught `"optional"` in JSDoc after the field was renamed to `roleKey`)
- Is each JSDoc block immediately above the function it documents? (inserting helpers between JSDoc and its export attaches the docs to the wrong function)
- Do comments hardcode counts, versions, or phase numbers that will go stale? Use generic language instead
- Are all function parameters used? If not, remove or use them
- Do mock/test URLs match the actual production endpoints? (read the production code to verify)
- Do fixture shapes match what the production code expects? (check Zod schemas and actual API calls)

## Consistency

- Are constants duplicated across files? (single source of truth)
- Are imports unused?
- Do config options extend defaults rather than replacing them?
- Was the same fix applied everywhere it's needed? (don't fix helpers but miss test files)
- Do any imported modules cache global state that could leak between tests? (reset caches in `afterEach`)
- Do test assertions use full expected values, not ambiguous substrings?
- Are module-scoped mutable variables (e.g. mock implementations) reset in `afterEach`? (prevents test leaking)
- Do docs reference files that only exist in memory (`~/.claude/projects/`) but not in the repo? Contributors can't see memory files

## Monorepo-specific

- Are cross-package imports using the package name (`@chief-clancy/core`), not relative paths (`../../core/`)?
- Are new exported functions/types added to the package's barrel export (`index.ts`)?
- Does changing a shared type in core break downstream packages (terminal, wrapper)?
- Are `workspace:*` dependencies correct? (core has no workspace deps, terminal depends on core)
- Do new modules respect the dependency direction? (core ← terminal ← wrapper)

## Public API surface

- Are new barrel exports genuinely public API, or internal modules that intra-package code consumes via `~/` imports? (installer internals should not be in the package barrel)

## Security / robustness

- Is `execSync` used with string interpolation? (use `execFileSync` with argument arrays)
- Are test credential values constructed at runtime where needed? (GitHub secret scanner)
- Does any security guard use `existsSync` before `lstatSync`? If so, dangling symlinks bypass it — use `lstatSync` in a try/catch swallowing only ENOENT instead
- Do catch blocks only swallow expected error codes? (e.g. only ENOENT, not EACCES/EPERM — unexpected filesystem states should fail loud)

## Config inheritance

- Did changing a config file affect other configs that extend it? (e.g. `tsconfig.build.json` extends `tsconfig.json`)
- Did changing a shared ESLint rule affect test file overrides?
