# Development Process

How the Clancy monorepo is developed. Covers the phase-based delivery lifecycle, review process, and session patterns.

**Last reviewed:** 2026-03-23

---

## Quick Reference

1. **Read** — brief + PROGRESS.md
2. **Validate** — phase validation protocol (if starting a new phase)
3. **Build** — tracer bullet TDD: one test → implement → next test → repeat → refactor → lint
4. **Review gate** — DA review → self-review → fix all findings → create PR → Copilot review → fix findings
5. **Ship** — squash merge, update PROGRESS.md

---

## Two Modes: Scaffold vs Application Code

### Phase 1 (Scaffold) — direct to main

Config files, tooling setup, docs. No feature branches needed. Commit directly to main.

### Phase 2+ (Application Code) — branches + PRs

All code changes go through: branch → review gate → PR → Copilot review → squash merge. See [Review Gate](#review-gate--da--self-review--copilot) below.

---

## Package Evolution

v1 ships as two packages (`core` + `terminal`) but code is organised internally by **capability directories** that map to future packages (`dev/`, `brief/`, `plan/`, `design/`, `qa/`, `automate/`). When placing code during any phase, use the correct capability directory — not flat `lifecycle/` or `pipeline/`.

See [package evolution strategy](decisions/architecture/package-evolution.md) for the full directory map, extraction criteria, and target architecture.

---

## Phase-Based Delivery

The monorepo is built in 14 phases, each containing small, focused PRs. See the [monorepo brief](decisions/monorepo/brief.md) for the full phase breakdown.

Each PR follows **tracer bullet TDD** — vertical slices, not horizontal:

```
WRONG (horizontal):
  Write ALL tests → write ALL implementation

RIGHT (vertical / tracer bullet):
  One test → implement to pass → next test → implement to pass → refactor
```

1. **Plan** — identify the behaviours to test (not implementation steps). Confirm the public interface.
2. **Tracer bullet** — write ONE test for the first behaviour. Implement minimal code to make it pass. This proves the path works end-to-end.
3. **Incremental loop** — for each remaining behaviour: write one test → minimal code to pass → repeat. Don't anticipate future tests.
4. **Refactor** — once all tests pass, look for duplication, module deepening, SOLID improvements. Never refactor while red.
5. **Verify** — lint + typecheck must pass.
6. **Review gate** before merge.

**Why vertical slices?** Tests written in bulk test _imagined_ behaviour, not _actual_ behaviour. Writing one test at a time means each test responds to what you learned from the previous cycle. The tests end up testing real behaviour through public interfaces, not implementation details.

---

## Phase Validation Protocol

Before starting each phase, spin up two agents in parallel:

### Breakdown Validator

- Read the phase's PR list from the brief
- Read relevant source code from the old Clancy repo (`~/Desktop/alex/clancy`)
- Check: Is each PR truly single-responsibility? Could any be split further?
- Check: Are there hidden dependencies between PRs that aren't captured?
- Check: Are the exit criteria testable and specific enough?
- Check: What modules from the old codebase need to be read?
- Check: Are there edge cases or cross-cutting concerns that will surface mid-PR?

### DA Agent

- Read the phase's PR list from the brief
- Read relevant source code from the old Clancy repo
- Check: Is anything missing? Files, tests, config changes?
- Check: Is the order right? Would a different PR sequence reduce rework?
- Check: Are we over-scoping or under-scoping any PR?
- Check: What's the most likely thing to go wrong in this phase?

Adjust the PR breakdown based on findings. Only begin implementation after both agents approve.

---

## Session Pattern

Every session follows this pattern:

```
1. Read the brief (decisions/monorepo/brief.md)
2. Read PROGRESS.md to see current state
3. Run phase validation (if starting a new phase)
4. Pick up the next PR
5. Tracer bullet TDD: one test → implement → next test → repeat → refactor → lint
6. Review gate: DA review → self-review → fix findings (Phase 2+)
7. Create PR, request Copilot review, fix findings (Phase 2+)
8. Squash merge, mark PR complete in PROGRESS.md
9. If handing off: update handoff doc with summary
```

### When to Hand Off

Start a new session when **any** of these triggers fire:

1. **3 PRs completed** in the current session — context is accumulating, fresh start is better
2. **Context compression detected** — Claude's responses get vaguer, repeat themselves, or miss things previously discussed
3. **Task boundary** — switching between unrelated work (e.g. finishing Phase 1 scaffold, starting Phase 2 application code)
4. **Two failed corrections** — if Claude does something wrong twice despite corrections, the context is polluted with failed approaches. Start fresh with a better prompt.

**How to hand off:**

1. Update PROGRESS.md with current state
2. Save any important decisions to memory (so future sessions have context)
3. Leave a handoff summary with:
   - What was completed (PR numbers, key files)
   - What's next (next PR, any setup needed)
   - Any decisions made or blockers hit
   - If mid-PR: current branch, what's done, what remains

The next session starts clean: reads the brief, reads PROGRESS.md, picks up where the handoff left off. Fresh context with full recall via memory and docs.

---

## Context Management

### Use subagents for exploration

When investigating code in the old repo or exploring architecture options, use subagents (`Agent` tool) instead of reading files directly. Subagents run in separate context windows — they explore, summarise, and report back without filling the main conversation with file contents.

This is especially important for:

- Phase validation (reading old repo code for each PR)
- DA reviews (reviewing all changed files)
- Codebase exploration before implementing a module

### Clear between unrelated tasks

If a session switches between unrelated work (e.g. fixing a config issue then starting a new PR), use `/clear` to reset context. Long sessions with irrelevant context reduce quality.

### DA reviews use fresh context

The DA review agent runs as a subagent — it reviews code in a separate context, not biased by having just written it. This is the writer/reviewer pattern: the agent that wrote the code should not be the same context that reviews it.

---

## Review Gate — DA → Self-Review → Copilot

Three checks, in this strict order, before merging a PR. **DA always runs before self-review** — DA catches architectural issues that change what the self-review should focus on.

### 1. DA Review (architecture-level)

Spin up a devil's advocate agent to read all changed files. For non-trivial changes this is mandatory.

**DA mindset: assume the code is wrong until proven otherwise.** The DA is not a polite colleague — it's a strict reviewer who actively looks for ways the code can break, be exploited, or surprise future callers. Err on the side of over-flagging. If uncertain, flag it as medium+.

**What DA checks:**

Architecture & conventions:

- Architecture violations (cross-package imports, dependency direction)
- Boundary violations (core importing from terminal)
- Consistency with conventions (complexity limits, functional rules, chaining limits, named booleans)
- Missing JSDoc on exported functions, JSDoc proximity to exports
- Unnecessary complexity or over-engineering

Completeness:

- Missing tests for new exported functions
- Edge cases not handled
- Stale references (renamed files, moved modules, wrong paths)
- Type safety issues (sneaky `any`, unsafe casts, missing narrowing)

Public API:

- Should this be exported? Who calls it? Are internal modules leaking through the package barrel?
- Barrel export completeness (new exports added to `index.ts`?)

Security & error handling:

- How could a malicious or unexpected input exploit this function? (symlinks, path traversal, injection)
- Does any security guard use `existsSync` before `lstatSync`? (dangling symlink bypass)
- What happens when I/O operations fail? Are error codes checked specifically or caught broadly?
- Do catch blocks only swallow expected errors? (ENOENT is expected; EACCES/EPERM should fail loud)
- Are file paths constructed safely? (use `node:path` join, reject path separators in user input)

Cross-platform:

- Does this work on Windows? (path separators, CRLF line endings, platform-specific APIs)

**Severity handling:**

- **Medium+ findings:** must be fixed before proceeding
- **Low findings:** can be acknowledged and deferred with explicit justification
- If you disagree with a finding, articulate why — don't silently skip it
- Deferring a DA finding to see if Copilot catches it is not acceptable — fix it now
- When in doubt, flag it. A false positive costs a minute to evaluate; a missed finding costs a round-trip with Copilot

### 2. Self-Review (line-level)

Run through the **[Self-Review Checklist](SELF-REVIEW.md)**. Read every changed file (`git diff main...HEAD`) and check for detail-level issues that DA misses — stale comments, wrong endpoints, fixture shapes, unused params, test isolation.

### 3. Copilot Review (PR-level)

After DA and self-review are clean:

1. Push branch and create PR
2. Request Copilot review:
   ```bash
   gh api repos/{owner}/{repo}/pulls/{number}/requested_reviewers \
     -X POST -f "reviewers[]=copilot-pull-request-reviewer[bot]"
   ```
3. For each Copilot comment:
   - **Evaluate** — understand the underlying issue, not just the suggested code. Copilot identifies valid problems but its fix may not follow our conventions. Decide the best approach independently.
   - **Fix or decline** — apply your own fix if it better follows conventions, apply Copilot's if it's the best option, or decline with reasoning. Always check fixes against CONVENTIONS.md (chaining limits, named booleans, type over interface, etc.).
   - **Before declining, ask: "What would DA and self-review say?"** Think through whether the issue matters for exported functions, security, cross-platform, or future callers. Pushing back is fine, but only after genuinely stress-testing the reasoning — not as a default response.
   - **Reply** — always reply to every comment explaining what was done and why. If diverging from Copilot's suggestion, explain the reasoning.
4. If pushing additional commits, update the PR body to reflect all changes

### When to skip reviews

**What is non-trivial?** Code with logic (new functions, changed conditionals, refactored modules), changed type signatures, new env vars, test infrastructure changes. All non-trivial changes get the full review gate.

**What is trivial?** Typos, badge updates, reformatting, adding test cases to proven structures. Trivial changes can skip DA but should still get a self-review pass.

### Why this order matters

DA may flag issues that change the code, which invalidates a self-review done earlier. Self-review may fix issues that change what Copilot sees. Running them out of order means repeating work or shipping with stale artifacts.

The self-review checklist is a **living document** — when Copilot catches something the self-review should have spotted, add the check to [SELF-REVIEW.md](SELF-REVIEW.md) immediately.

---

## Versioning

| Package                  | Initial version | Rationale                                          |
| ------------------------ | --------------- | -------------------------------------------------- |
| `@chief-clancy/core`     | 0.1.0           | New package, proven code, unstable API surface     |
| `@chief-clancy/terminal` | 0.1.0           | New package, proven code, unstable API surface     |
| `chief-clancy` (wrapper) | 0.9.0           | Continues existing lineage, becomes thin re-export |

Independent versioning managed by `@changesets/cli`. Coordinated v1.0.0 release when API surfaces are stable.

**No npm publishing until feature parity with current Clancy.** GitHub release tags only during development.

---

## Release Flow

1. Create a changeset: `pnpm changeset`
2. Apply version bumps: `pnpm changeset version`
3. Commit the version bump + changelog
4. GitHub Actions creates release tags
5. When ready for npm: changesets handles the publish flow

---

## Quality Gates

Every PR must pass before merging:

- [ ] All tests pass (`pnpm test`)
- [ ] Type-check clean (`pnpm typecheck`)
- [ ] Lint clean (`pnpm lint`)
- [ ] Format clean (`pnpm format:check`)
- [ ] Quality tools pass (`pnpm knip && pnpm publint && pnpm attw`)
- [ ] DA review completed (for non-trivial changes)
- [ ] Self-review checklist completed
- [ ] Copilot review findings addressed
- [ ] PROGRESS.md updated

---

## When to Update This Doc

Update DEVELOPMENT.md when:

- A new step is added to the process
- The phase validation protocol changes
- The review gate process changes
- The release flow changes
