# Self-Review Checklist

Line-level accuracy check performed after DA review but before creating a PR. Read every changed file (`git diff main...HEAD`) and check for detail-level issues that DA and CodeRabbit miss.

This checklist complements [DA-REVIEW.md](DA-REVIEW.md) with explicit ownership split:

- **DA-REVIEW** owns the **architectural and comment/doc layer**: imports, guards, patterns, stale prose in JSDoc and comments.
- **SELF-REVIEW** owns the **code-level layer**: stale fixture values, mock URLs, wrong string literals, test isolation, copy-paste errors.

The Red Flags list lives in [DA-REVIEW.md](DA-REVIEW.md#red-flags--stop-and-reassess) — read it before walking this checklist. Don't duplicate Red Flags here; cross-reference instead. When the headline meta-rationalization in [RATIONALIZATIONS.md](RATIONALIZATIONS.md#headline--the-meta-rationalization) catches you mid-review, that's the signal that you're about to skip a check while telling yourself you ran it.

This is a **living document** — when CodeRabbit catches something the self-review should have spotted, add the specific check here immediately. The checklist grows from real mistakes, not hypotheticals.

See also: [DEVELOPMENT.md](DEVELOPMENT.md) for the full review gate flow, [TESTING.md](TESTING.md) for test-specific disciplines.

**Last reviewed:** 2026-04-13

---

## NOTICED BUT NOT TOUCHING

When you spot something worth improving outside your task scope, **list it — don't fix it**:

```
NOTICED BUT NOT TOUCHING:
- src/utils/format.ts has an unused import (unrelated to this task)
- The auth middleware could use better error messages (separate task)
→ Want me to create tasks for these?
```

Drive-by refactors mixed with feature work are harder to review, harder to revert, and hide bugs in noise. Stay in scope. The temptation to "quickly clean this up while I'm here" is exactly the rationalization in [RATIONALIZATIONS.md](RATIONALIZATIONS.md#build) — surface it as a NOTICED block and move on.

---

## Code accuracy

> Comment-level and JSDoc accuracy is owned by [DA-REVIEW.md](DA-REVIEW.md#jsdoc--documentation). Self-review focuses on accuracy in **actual code values**: fixture data, mock URLs, hardcoded literals, parameter usage.

- Are all function parameters used? Remove unused params or use `_prefixed` naming if keeping for API stability
- Do mock/test URLs match the actual production endpoints? (read the production code to verify)
- Do fixture shapes match what the production code expects? (check Zod schemas and actual API calls)
- Do hardcoded string literals in test fixtures match the values the production code emits? (e.g. `LOCAL_APPROVE_PLAN_PUSH` audit token spelt the same way in fixture and production)
- Do hardcoded numeric expectations (`toHaveBeenCalledTimes(N)`, array length assertions) reflect the actual code path, not the OLD code path before your change?

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

## Test permissiveness audit

For every new regex assertion or slice-based string check, walk through the simplest wrong input the assertion would silently pass. The discipline is owned by [DA-REVIEW.md](DA-REVIEW.md#test-permissiveness-audit) — this is the self-review companion.

- For new regexes: write down a wrong-input example. Would the regex still match? If yes, tighten it.
- `\\?d` matches both `\d` and bare `d` (the literal escape is wrong — use `\\d`). Same trap for `\\?w`, `\\?s`, etc.
- `[^\n]*` middles in regex assertions silently allow swapped labels. Anchor the literal you actually care about.
- `content.indexOf(marker) + slice()` returns negative indexes when the marker is missing, and `slice` interprets negatives as end-relative — guard with `>= 0` and `end > start` before slicing. Extract a `sliceBetween()` helper to make the trap structurally impossible. _Caught in: PR #222 (3 identical findings, fixed via `sliceBetween()` extraction)._
- Substring `toContain('foo')` when an exact match (`toBe('foo')`) is what you actually want
- `not.toContain` slices that don't bound the slice region — verify both slice markers exist before asserting absence

If the assertion would pass against the wrong input, tighten it before committing.

## Workflow/prompt file accuracy

Workflow `.md` files are as load-bearing as TypeScript — Claude follows them step-by-step. Apply the same rigour as code review.

- **Control flow completeness** — does every conditional path (if/else, success/failure, found/not-found) have an explicit outcome? Look for steps that warn but don't stop, then fall through to a success message. _Caught by Copilot: PR #269 Step 8 warned on unchanged version then fell through to Step 9 success._
- **Parameterised values** — are hardcoded values (flags, package names, paths) correct for all execution paths? A fallback message shouldn't hardcode `--local` when the workflow also handles `--global` and `both`. _Caught by Copilot: PR #269 Step 2 fallback._
- **Post-rename sweep** — after renaming a command (e.g. `/clancy:update` → `/clancy:update-terminal`), grep all workflow files, help text, and descriptions for the old name. Check that descriptions still make sense with the new name ("Update Clancy" is ambiguous when per-package updates exist). _Caught by Copilot: PR #272 ambiguous descriptions._
- **Forward references** — if a workflow references a command that ships in a later PR (e.g. `/clancy:update-terminal` before PR U4), add a comment in the PR body explaining the forward reference. Copilot flags these every time.
- **Step number consistency** — after inserting or renumbering steps, grep for `Step N` references in the same file AND cross-referencing files (approve workflows, tests, other commands that mention step numbers)
- **Table column alignment** — markdown tables rendered by Prettier may have different column widths than hand-written ones. Run `pnpm format` before checking table rendering
- **Multi-mode prompt simulation** — if a prompt can be invoked with different inputs (flags, modes, step contexts), mentally execute it with each input type. Does every instruction still make sense? Does the output format work for all cases? Read the intro, every instruction, and the output template as if you were the LLM receiving input X — then repeat with input Y. _Caught by Copilot: PR #277 — DA agent intro said "You receive 10-15 clarifying questions" which was false for the Step 8a health-check invocation that passes a generated brief._
- **Derived threshold alignment** — when a check references a rule defined elsewhere (e.g., "max N rows", "size L = 4+ hours"), verify the threshold matches the source rule. Grep for the authoritative value in the file that defines it. _Caught by Copilot: PR #277 — health check flagged >15 rows but brief.md's own decomposition rules cap at 10._
- **Post-fix consistency sweep** — after changing a value or detection rule at one location (e.g. fixing `GITHUB_TOKEN` detection in Step 1), grep the entire file for the same value to find all other locations that reference it. Fix once, miss the duplicate = the same bug in a different step. _Caught by Copilot: PR #289 — fixed Step 1 GitHub detection to require both `GITHUB_TOKEN` + `GITHUB_REPO`, but Q1 auto-detection hint still listed `GITHUB_TOKEN` alone._
- **Output content read-aloud** — for every user-facing output block (welcome messages, final output, error messages), read it as if you are the user seeing it for the first time. Ask: "Do I know what to do next?" If the output lists commands, verify every command the user needs is present. _Caught by Copilot: PR #289 — local-mode final output listed brief/plan but omitted `/clancy:implement --from`, the command that actually executes the plan._
- **Credential dual-use audit** — when a workflow removes, overwrites, or gates on a credential var, check whether that var serves a second purpose. `GITHUB_TOKEN` is both a GitHub Issues board credential AND a git-host token for PR creation. `AZDO_PAT` is both a board credential and a git-host token. Removing "all board vars" on disconnect nukes the git-host token too. _Caught by Copilot: PR #289 — disconnect removed all board vars including shared git-host tokens._
- **Platform parity check** — when listing supported platforms (board providers, git hosts, etc.), grep the codebase for every platform value and verify each user-facing list matches the implementation. Azure DevOps and Bitbucket Server are the most commonly omitted. _Caught by Copilot: PR #289 — standalone git host question omitted Azure DevOps; `CLANCY_GIT_PLATFORM` comment omitted `bitbucket-server`._

### Structural traps in workflow markdown

- **GFM table cells escape pipes** — regexes with `|` (alternation) inside markdown table cells get auto-escaped by Prettier to `\|`. The LLM reads this as a literal pipe, not alternation. Fix: pull regexes with pipes out of the table into a separate paragraph.
- **Nested backticks inside bold spans** — nesting inline code inside `**...**` trips Prettier's formatter, silently rewriting the file on every save. Fix: drop the outer bold; use single bold words or a separate sentence.
- **Multi-step audit-log ordering** — if Step 4c claims to write "after Step 7's row" but executes before Step 7, the ordering is unachievable. Fix: defer ALL writes to the last step that runs; have it write in the correct order.

## Carried-over content

- Do hardcoded version numbers match the repo's config? (CodeRabbit caught Node 22+ in role docs when `engines.node` requires >=24.0.0)
- Do markdown code fences open and close with the same number of backticks? (CodeRabbit caught ``` opening with ```` closing — breaks rendering)

## Consistency

- Are constants duplicated across files? (single source of truth — `grep` for the value)
- Are imports unused?
- Was the same fix applied everywhere it's needed? (don't fix helpers but miss test files)
- Do config options extend defaults rather than replacing them?
- Do docs reference files that only exist in memory (`~/.claude/projects/`) but not in the repo? Contributors can't see memory files
- After renaming a config key or constant, are all references updated? (not just the definition)

## Lint-staged safety

- Do test helper return types expose mutable collections (`Map`, `Set`, `Array`)? `eslint --fix` auto-converts them to `ReadonlyMap`/`ReadonlySet`/`ReadonlyArray`, breaking `.set()`/`.add()`/`.push()` calls. Use accessor methods instead (PR #49 CI failure)
- After writing a new test file, run `pnpm eslint --fix <file> && pnpm typecheck` to verify lint-staged won't break it on commit

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
- Does a new module with external consumers have a barrel `index.ts`? Do external imports use the barrel path (`/index.js`) not the direct file path? (Phase 8 audit found 11 modules missing barrels)

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

---

## See also

- [DA-REVIEW.md](DA-REVIEW.md) — architectural and comment/doc layer review (DA owns), Red Flags, Required disciplines, Severity Labels
- [DEVELOPMENT.md](DEVELOPMENT.md) — full review gate flow and Phase Validation Protocol
- [TESTING.md](TESTING.md) — Prove-It Pattern, mock-at-boundaries, state-vs-interaction, test anti-patterns
- [RATIONALIZATIONS.md](RATIONALIZATIONS.md) — anti-rationalization index, especially the [Test](RATIONALIZATIONS.md#test) and [Review](RATIONALIZATIONS.md#review) sections
