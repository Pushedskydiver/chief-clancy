# DA Review Checklist

Structured checklist for the devil's advocate review agent. Walk every item against every changed file. Assume the code is wrong until proven otherwise.

This is a **living document** — when Copilot catches something the DA should have spotted, add the specific check here immediately.

**Last reviewed:** 2026-03-23

---

## Architecture & conventions

- [ ] No cross-package imports violating dependency direction (core ← terminal ← wrapper)
- [ ] No boundary violations (core importing from terminal or chat)
- [ ] Complexity limits respected (cyclomatic 10, cognitive 15, 50 lines/function, 300 lines/file, max-depth 3)
- [ ] Functional rules followed (`const` everywhere, no mutation, no `reduce()`, no nested ternaries)
- [ ] Max 3 chained method calls — beyond 3, use named intermediates
- [ ] Inline callbacks in chains are 1–2 lines — extract longer logic into named functions
- [ ] Compound boolean conditions extracted into named `const` variables
- [ ] `type` used over `interface` (unless declaration merging needed)
- [ ] Types co-located with their module (not prematurely in `types/`)
- [ ] No unnecessary complexity or over-engineering

## JSDoc & documentation

- [ ] JSDoc on all exported functions with `@param` and `@returns`
- [ ] Explicit return types on exported functions
- [ ] JSDoc block immediately above the function it documents (no helpers inserted between)
- [ ] Comments match what the code actually does (stale comments after refactoring)
- [ ] No hardcoded counts, versions, or phase numbers in comments

## Completeness

- [ ] Unit tests for every exported function
- [ ] Edge cases tested (empty input, missing files, malformed data)
- [ ] Stale references checked (renamed files, moved modules, wrong paths in comments)
- [ ] Type safety — no sneaky `any`, unsafe `as` casts justified with comments, `unknown` + narrowing used

## Public API surface

- [ ] Should this be exported? Who calls it? Are internal modules leaking through the package barrel?
- [ ] Barrel export completeness — or correctly NOT exported (knip will flag unused barrels)

## Security & error handling

- [ ] How could malicious or unexpected input exploit each function? (symlinks, path traversal, injection)
- [ ] Symlink handling — does `readdirSync` or directory walking follow symlinks outside the intended tree? Check `entry.isSymbolicLink()`
- [ ] Path traversal — are paths from external input (JSON, user input) validated to stay within the expected directory? Use `path.relative()` to check
- [ ] Does `readdirSync` with `withFileTypes` assume entries are files or directories? Check `entry.isFile()` explicitly — FIFO/socket/block device entries exist
- [ ] Does any security guard use `existsSync` before `lstatSync`? Dangling symlinks bypass it
- [ ] TOCTOU races — is `existsSync` followed by a read/write on the same path? Wrap in try/catch instead
- [ ] Do catch blocks only swallow expected error codes? (ENOENT is expected; EACCES/EPERM should fail loud)
- [ ] Are file paths constructed safely? (`path.join`, reject path separators in user input)
- [ ] If one function guards input paths, is the same guard applied in every exported function that accepts similar paths? (PR 2.3: DA caught traversal on detect but Copilot caught the gap on backup)
- [ ] Does metadata/logging accurately reflect what actually happened? If operations can be skipped, track successes and report those, not the input list

## Cross-platform

- [ ] Does this work on Windows? (path separators, CRLF line endings, platform-specific APIs)
- [ ] Are path checks using `path.relative()` / `path.sep` instead of hardcoded `/`? (PR 2.3: `startsWith(base + '/')` failed on Windows)
- [ ] Are forward slashes in relative paths consistent across platforms?

## Severity handling

- **Medium+ findings:** must be fixed before proceeding
- **Low findings:** can be acknowledged and deferred with explicit justification
- If you disagree with a finding, articulate why — don't silently skip it
- Deferring a DA finding to see if Copilot catches it is not acceptable — fix it now
- When in doubt, flag it. A false positive costs a minute to evaluate; a missed finding costs a round-trip with Copilot
