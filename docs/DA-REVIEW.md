# DA Review Checklist

Structured checklist for the devil's advocate review agent. Walk every item against every changed file. Assume the code is wrong until proven otherwise.

This is a **living document** — when Copilot catches something the DA should have spotted, add the specific check here immediately.

**Last reviewed:** 2026-03-23

---

## Architecture & imports

- [ ] No cross-package imports violating dependency direction (core ← terminal ← wrapper)
- [ ] No boundary violations (core importing from terminal or chat)
- [ ] Should this be exported? Who calls it? Are internal modules leaking through the package barrel?
- [ ] Barrel export completeness — or correctly NOT exported (knip will flag unused barrels)

## Conventions & code patterns

- [ ] Complexity limits: cyclomatic ≤ 10, cognitive ≤ 15, max-depth ≤ 3
- [ ] Size limits: ≤ 50 lines/function (excluding blanks/comments), ≤ 300 lines/file
- [ ] `const` everywhere, no mutation (`spread`/`concat` not `push`/`splice`), no `reduce()`
- [ ] No nested ternaries; multiline ternaries use `if`/`else` instead
- [ ] Max 3 chained method calls — beyond 3, use named intermediates
- [ ] Inline callbacks in chains are 1–2 lines of code — extract longer logic into named functions
- [ ] Compound boolean conditions extracted into named `const` variables
- [ ] Functions with 3+ parameters use options objects (not individual params)
- [ ] Max one level of function nesting — no functions defined inside functions defined inside functions
- [ ] `type` used over `interface` (unless declaration merging needed)
- [ ] Types and helpers co-located with their module — extract to `shared/` only at 2+ consumers
- [ ] No `eslint-disable` without justification — look for simpler alternatives first
- [ ] Naming: files/dirs kebab-case, types PascalCase, functions camelCase, constants UPPER_SNAKE_CASE

## JSDoc & documentation

- [ ] JSDoc on all exported functions with `@param` and `@returns`
- [ ] Explicit return types on exported functions
- [ ] JSDoc block immediately above the function it documents (no helpers inserted between)
- [ ] Comments match what the code actually does (stale comments after refactoring)
- [ ] No hardcoded counts, versions, or phase numbers in comments

## Type safety

- [ ] No `any` — use `unknown` + type narrowing
- [ ] Unsafe `as` casts justified with inline comments explaining why
- [ ] I/O functions (fetch, exec, fs) injected as parameters in pure logic, not imported at module level
- [ ] Pure logic separated from side effects — boundary functions isolated

## Completeness

- [ ] Unit tests for every exported function
- [ ] Edge cases tested (empty input, missing files, malformed data)
- [ ] Parsers, serializers, and string transformers use property-based tests (fast-check)
- [ ] Tests co-located with source (`module/module.test.ts`)
- [ ] Stale references checked (renamed files, moved modules, wrong paths in comments)

## Security & error handling

- [ ] How could malicious or unexpected input exploit each function? (symlinks, path traversal, injection)
- [ ] Symlink handling — does directory walking check `entry.isSymbolicLink()`? Does it follow symlinks outside the intended tree?
- [ ] Entry type guards — does `readdirSync` with `withFileTypes` check `entry.isFile()` explicitly? (FIFO/socket/block device entries exist)
- [ ] Path traversal — are paths from external input (JSON, user input) validated to stay within the expected directory? Use `path.relative()` to check
- [ ] Path traversal guards consistent — if one exported function guards paths, every exported function accepting paths has the same guard
- [ ] TOCTOU races — is `existsSync` followed by a read/write on the same path? Wrap in try/catch instead
- [ ] Dangling symlinks — `existsSync` doesn't detect them; use `lstatSync` in try/catch swallowing only ENOENT
- [ ] Catch blocks only swallow expected error codes (ENOENT is expected; EACCES/EPERM should fail loud)
- [ ] File paths constructed safely (`path.join`, reject path separators in user input)
- [ ] Metadata/logging reflects actual outcomes — if operations can be skipped, track successes, not the input list

## Cross-platform

- [ ] Path checks use `path.relative()` / `path.sep` instead of hardcoded `/`
- [ ] Text processing handles both `\n` and `\r\n` line endings
- [ ] No platform-specific APIs without cross-platform alternatives

## Severity handling

- **Medium+ findings:** must be fixed before proceeding
- **Low findings:** can be acknowledged and deferred with explicit justification
- If you disagree with a finding, articulate why — don't silently skip it
- Deferring a DA finding to see if Copilot catches it is not acceptable — fix it now
- When in doubt, flag it. A false positive costs a minute to evaluate; a missed finding costs a round-trip with Copilot
