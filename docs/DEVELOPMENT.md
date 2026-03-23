# Development Process

How the Clancy monorepo is developed. Covers the phase-based delivery lifecycle, review process, and session patterns.

**Last reviewed:** 2026-03-23

---

## Quick Reference

1. **Read** — brief + PROGRESS.md
2. **Validate** — phase validation protocol (if starting a new phase)
3. **Build** — TDD: write tests → implement → lint passes
4. **Review** — DA review of completed PR
5. **Ship** — mark PR complete in PROGRESS.md, commit

---

## Phase-Based Delivery

The monorepo is built in 14 phases, each containing small, focused PRs. See the [monorepo brief](decisions/monorepo/brief.md) for the full phase breakdown.

Each PR follows TDD:
1. Write tests first against the desired interface
2. Implement to make tests pass
3. Lint + typecheck must pass
4. DA review before marking complete

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
1. Read the brief (docs/decisions/monorepo/brief.md)
2. Read PROGRESS.md to see current state
3. Run phase validation (if starting a new phase)
4. Pick up the next PR
5. TDD: write tests → implement → lint → review
6. DA review of completed PR
7. Mark PR complete in PROGRESS.md
8. If handing off: update handoff doc with summary
```

### Session Handoff

When context degrades or a session ends mid-phase, leave a handoff with:
- What was completed
- What's next
- Any decisions made or blockers hit

---

## Devil's Advocate Reviews

### When to Review

| Phase | What the DA checks |
|---|---|
| **Phase start** | PR breakdown, scope, ordering, missing items |
| **PR complete** | Bugs, stale references, missing tests, type safety, architecture violations |
| **Pre-merge** | Cross-doc consistency, version numbers, test counts |

### Severity Handling

- **Medium+ findings:** must be fixed before proceeding
- **Low findings:** can be acknowledged and deferred with justification
- If you disagree with a finding, articulate why — don't silently skip it

---

## Versioning

| Package | Initial version | Rationale |
|---|---|---|
| `@chief-clancy/core` | 0.1.0 | New package, proven code, unstable API surface |
| `@chief-clancy/terminal` | 0.1.0 | New package, proven code, unstable API surface |
| `chief-clancy` (wrapper) | 0.9.0 | Continues existing lineage, becomes thin re-export |

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
- [ ] DA review completed (for non-trivial changes)
- [ ] PROGRESS.md updated

---

## When to Update This Doc

Update DEVELOPMENT.md when:
- A new step is added to the process
- The phase validation protocol changes
- The DA review process changes
- The release flow changes
