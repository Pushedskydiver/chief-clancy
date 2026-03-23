## Summary

<!-- What does this PR do and why? Keep it to one paragraph. -->

## Changes

<!-- Bullet list of what changed. Group by file or concern. -->

-

## Type of change

<!-- Check one. This determines the PR label. -->

- [ ] `feature` — New feature
- [ ] `fix` — Bug fix
- [ ] `chore` — Maintenance, deps, config, refactor, docs

## Packages affected

<!-- Check all that apply. -->

- [ ] `core` — @chief-clancy/core
- [ ] `terminal` — @chief-clancy/terminal
- [ ] Neither (root config, docs, CI)

## Checklist

### Code quality

- [ ] All checks pass: `pnpm test && pnpm typecheck && pnpm lint && pnpm format:check`
- [ ] No `any` — uses `unknown` + type narrowing
- [ ] JSDoc on all new exported functions with explicit return types
- [ ] Functions under 50 lines, files under 300 lines
- [ ] Cross-package imports use `@chief-clancy/core`, not relative paths

### Testing

- [ ] Tests added or updated (co-located `<name>/<name>.test.ts`)
- [ ] Tracer bullet TDD: one test → implement → next test → repeat
- [ ] Property-based tests for parsers/transformers (if applicable)

### Completeness

- [ ] Barrel exports updated (`index.ts`) for new public API
- [ ] PROGRESS.md updated (if completing a phase PR)
- [ ] Changeset created (`pnpm changeset`) for version-worthy changes

### Review

- [ ] DA review completed (for non-trivial changes)
- [ ] Self-review checklist completed ([SELF-REVIEW.md](../docs/SELF-REVIEW.md))

## How was this tested?

<!-- What commands did you run? What did you verify? -->

```bash
pnpm test
pnpm typecheck
pnpm lint
```

## Related issues

<!-- Closes #N, Fixes #N, or "None" -->
