# Git Conventions

## Branch Strategy

```
main ← feature/ | fix/ | chore/
```

All work branches from `main` and merges back to `main` via PR.

### Branches

| Branch           | Purpose                          | Branched from | Merges into |
| ---------------- | -------------------------------- | ------------- | ----------- |
| `main`           | Production code, tagged releases | —             | —           |
| `feature/<name>` | New features                     | `main`        | `main`      |
| `fix/<name>`     | Bug fixes                        | `main`        | `main`      |
| `chore/<name>`   | Maintenance, deps, config        | `main`        | `main`      |

### Rules

- **If it runs, it needs a PR.** TypeScript (`packages/*/src/`), tests, executable markdown, package.json, CI config (`.github/`) — always via branch + PR.
- **If it's only read by humans/agents for context, direct to main is fine — but only when no branch/PR is open.** Decision docs (`docs/decisions/`), glossary, architecture docs (`docs/`), CLAUDE.md doc link updates, README badge/link fixes, typo corrections. If you have an open feature branch, commit doc changes there instead — pushing to main while a branch is open creates divergent history and merge conflicts on squash merge.

**What is "executable markdown"?** Any markdown file containing instructions that Claude will execute as part of a command or workflow:

- `packages/terminal/src/roles/*/commands/*.md` — slash command definitions
- `packages/terminal/src/roles/*/workflows/*.md` — implementation workflows
- `packages/terminal/src/templates/CLAUDE.md` — template injected into user projects
- `packages/terminal/src/agents/*.md` — agent prompts

Docs in `docs/` are informational — Claude reads them for context but doesn't execute them as commands. They're safe for direct-to-main.

- Delete branches after merging
- CI must pass before merging

## Branch Naming

```
type/short-description
```

Types: `feature`, `fix`, `chore`

Each type has a matching GitHub PR label — use `--label {type}` when creating PRs. Do not create new PR labels unless adding a new branch prefix type.

Examples:

```
feature/context-monitor
fix/push-protection-test-values
chore/update-dependencies
```

Keep names short and descriptive. No ticket numbers (Clancy doesn't use an external board for its own development).

## Commit Messages

Format:

```
<gitmoji> <type>(scope): description
```

The gitmoji comes first, then the conventional commit type. Scope is optional.

### Types

| Type       | Gitmoji | Use for                                |
| ---------- | ------- | -------------------------------------- |
| `feat`     | ✨      | New feature                            |
| `fix`      | 🐛      | Bug fix                                |
| `chore`    | 📦      | Maintenance, deps, config              |
| `refactor` | ♻️      | Code change that doesn't fix or add    |
| `test`     | ✅      | Adding or updating tests               |
| `docs`     | 📝      | Documentation only                     |
| `style`    | 💄      | Formatting, cosmetic (no logic change) |
| `perf`     | ⚡️      | Performance improvement                |
| `security` | 🔒      | Security fix                           |
| `remove`   | 🔥      | Removing code or files                 |

### Examples

```
✨ feat: add credential guard PreToolUse hook
🐛 fix: use correct statusLine key and object format
📝 docs: add foundation docs for monorepo
💄 style: update badges to for-the-badge
✅ test: add credential guard unit tests
♻️ refactor: extract preflight into shared function
📦 chore: scaffold monorepo with pnpm workspaces
```

## Merge Strategy

- Feature/fix/chore branches: **squash merge** into `main`

## Release Flow

### During development (pre-feature-parity)

No npm publishing. GitHub release tags only.

1. Create a changeset: `pnpm changeset`
2. Apply version bumps: `pnpm changeset version`
3. Commit version bump + changelog
4. GitHub Actions creates release tags

### After feature parity

1. Include changeset in your PR
2. Squash merge PR to `main`
3. GitHub Actions: creates tags → builds → creates GitHub Release
4. Changesets handles npm publish coordination

### Tag conventions

- Package-scoped: `core@0.1.0`, `terminal@0.1.0`
- `chief-clancy` wrapper published last

## Tagging

- Tags follow semver per package: `{package}@MAJOR.MINOR.PATCH`
- Tags are created automatically by GitHub Actions when version bumps are detected
