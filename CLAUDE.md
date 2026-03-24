# Clancy Monorepo

Autonomous, board-driven development for Claude Code. Monorepo for `@chief-clancy/*` packages.

## Commands

```bash
pnpm build              # Build all packages
pnpm test               # Run all tests
pnpm lint               # Lint all packages
pnpm typecheck          # Type-check all packages
pnpm format             # Format with Prettier
pnpm format:check       # Check formatting

# Pre-push quality suite (run before every git push — no exceptions)
pnpm test && pnpm lint && pnpm typecheck && pnpm format:check && pnpm knip && pnpm publint && pnpm attw

# Changesets
pnpm changeset          # Create a changeset
pnpm changeset version  # Apply version bumps
```

## Commit format

```
<gitmoji> <type>(scope): description
```

- `✨ feat: add credential guard hook`
- `🐛 fix: construct test values at runtime`
- `📦 chore: scaffold monorepo with pnpm workspaces`
- `📝 docs: add foundation docs for monorepo`
- `♻️ refactor: extract preflight into shared function`
- `✅ test: add credential guard unit tests`

See `docs/GIT.md` for the full type/gitmoji table (10 types).

## PR workflow

```bash
gh pr create --assignee Pushedskydiver --label "feature" --label "core"
# Type labels: feature, fix, chore (must match branch prefix)
# Package labels: core, terminal
```

## Architecture

Dependency direction: core ← terminal ← chief-clancy. No reverse imports. Enforced by eslint-plugin-boundaries.

## Non-obvious constraints

- `zod/mini` for all runtime validation — not `zod`
- Hooks must be CommonJS — best-effort, must never crash
- Runtime scripts are esbuild bundles — self-contained, zero npm dependency
- Path aliases: `~/c/` → `core/src/*`, `~/t/` → `terminal/src/*`. Rewritten by `tsc-alias` at build time
- Types/opts objects start non-exported — only export when consumed outside the file
- Board modules: reuse header builders, schema-validate all responses, cache via `Cached<T>` class
- See `docs/CONVENTIONS.md` for export hygiene and board implementation patterns

## Process directives

- TDD: vertical slices. One test → implement → next test. Never write all tests first.
- Review order: DA review (subagent) → self-review → PR. Never skip or reorder.
- Hand off after 3 PRs or on context compression. Update PROGRESS.md.
- `docs/DA-REVIEW.md` and `docs/SELF-REVIEW.md` are living checklists — update when reviews catch new patterns.

## Key docs

Full process: `docs/DEVELOPMENT.md` | Code standards: `docs/CONVENTIONS.md` | Git rules: `docs/GIT.md`

## Reference

Old Clancy codebase: `~/Desktop/alex/clancy` — READ-ONLY reference. All work happens in this repo.
