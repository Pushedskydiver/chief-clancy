## Summary

<!-- What does this PR do? One paragraph. -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor (no behaviour change)
- [ ] Documentation update
- [ ] Tooling / config

## Checklist

- [ ] Tests added or updated (co-located `<name>.test.ts`)
- [ ] All checks pass (`pnpm test && pnpm typecheck && pnpm lint && pnpm format:check`)
- [ ] PROGRESS.md updated (if completing a PR)
- [ ] Barrel exports updated (`index.ts`) for new exports
- [ ] JSDoc on all new exported functions
- [ ] No `any` — uses `unknown` + type narrowing
- [ ] Cross-package imports use package name, not relative paths

## Testing

<!-- How did you test this? What commands did you run? -->
