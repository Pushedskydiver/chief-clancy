# Git Conventions

## Branch Strategy

```
main ← feature/ | fix/ | chore/ | refactor/ | docs/
```

All work branches from `main` and merges back to `main` via PR.

### Branches

| Branch            | Purpose                              | Branched from | Merges into |
| ----------------- | ------------------------------------ | ------------- | ----------- |
| `main`            | Production code, tagged releases     | —             | —           |
| `feature/<name>`  | New features                         | `main`        | `main`      |
| `fix/<name>`      | Bug fixes                            | `main`        | `main`      |
| `chore/<name>`    | Maintenance, deps, config            | `main`        | `main`      |
| `refactor/<name>` | Code restructuring, no new behaviour | `main`        | `main`      |
| `docs/<name>`     | Documentation only                   | `main`        | `main`      |

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

Types: `feature`, `fix`, `chore`, `refactor`, `docs`

Each type has a matching GitHub PR label — `refactor/` and `docs/` branches use the `chore` label.

Examples:

```
feature/context-monitor
fix/push-protection-test-values
chore/update-dependencies
refactor/terminal-autopilot-use-dev-queue
docs/session-67-summary
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

### No `--amend`

Always create a new commit instead of amending an existing one, even for small follow-up fixes. Each change is its own commit. Never use `git commit --amend`. Pre-commit hook failures: fix the issue, re-stage, create a NEW commit.

## Labels

### PR labels (required — one per PR)

Every PR must have exactly one type label. `refactor/` and `docs/` branches use the `chore` label:

| Label     | Branch prefix | When to use                          |
| --------- | ------------- | ------------------------------------ |
| `feature` | `feature/`    | New user-facing capability           |
| `fix`     | `fix/`        | Bug fix                              |
| `chore`   | `chore/`      | Maintenance, deps, config            |
| `chore`   | `refactor/`   | Code restructuring, no new behaviour |
| `chore`   | `docs/`       | Documentation only                   |

Apply with `--label {type}` when creating the PR.

### Package scope labels (recommended)

Add when the PR touches package-specific code:

| Label      | When to use                     |
| ---------- | ------------------------------- |
| `core`     | Changes to `packages/core/`     |
| `terminal` | Changes to `packages/terminal/` |
| `brief`    | Changes to `packages/brief/`    |
| `plan`     | Changes to `packages/plan/`     |
| `dev`      | Changes to `packages/dev/`      |
| `scan`     | Changes to `packages/scan/`     |

PRs touching multiple packages get multiple labels. Root-only changes (CI, docs, config) get no scope label.

### Issue labels

Applied automatically by issue templates:

| Label         | Source                   |
| ------------- | ------------------------ |
| `bug`         | Bug report template      |
| `enhancement` | Feature request template |

### Rules

- **Do not create ad-hoc labels.** If a new label is needed, discuss first and add it to this list.
- **One type label per PR.** Never apply both `feature` and `fix` to the same PR — pick the primary intent.
- **Scope labels are additive.** A PR can have `feature` + `core` + `terminal`.

## Merge Strategy

- Feature/fix/chore branches: **squash merge** into `main`
- **PR title = squash commit message** — must follow the gitmoji + conventional commit format above
- The PR title becomes the single commit message on `main`, so it must be descriptive and follow conventions

### Squash commit examples

```
✨ feat: add credential guard PreToolUse hook
🐛 fix: handle stale lock files on resume
♻️ refactor: extract delivery outcome as pure function
📦 chore: add ESLint with complexity and functional rules
```

The PR body provides detail; the squash commit (PR title) provides the one-line summary.

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

- Package-scoped: `@chief-clancy/core@0.1.0`, `@chief-clancy/terminal@0.1.7`, `@chief-clancy/brief@0.3.0`, `@chief-clancy/plan@0.5.0`
- `chief-clancy` wrapper (currently `chief-clancy@0.9.15`) published last
- Current published versions tracked in [DEVELOPMENT.md "Versioning"](DEVELOPMENT.md#versioning)

## Tagging

- Tags follow semver per package: `{package}@MAJOR.MINOR.PATCH`
- Tags are created automatically by GitHub Actions when version bumps are detected

## Changelog Format

Each package maintains its own `CHANGELOG.md`, generated by `@changesets/cli`. The format uses gitmoji section headers matching the commit types:

```markdown
# @chief-clancy/core

## 0.2.0

### ✨ Features

- **Board factory type narrowing** — `createBoard()` returns typed board
  instances based on provider config. Eliminates downstream type assertions.

### 🐛 Fixes

- **Stale lock detection** — check PID liveness before blocking on existing
  lock file. Dead processes no longer prevent new runs.

### ♻️ Refactors

- **`fetchAndParse<T>()` shared utility** — generic fetch → JSON → Zod
  validation helper. Eliminates repeated boilerplate across 6 board modules.
```

### Section headers

| Header             | When to use                                 |
| ------------------ | ------------------------------------------- |
| `### ✨ Features`  | New user-facing capabilities                |
| `### 🐛 Fixes`     | Bug fixes                                   |
| `### ♻️ Refactors` | Code changes that don't fix or add features |
| `### ✅ Tests`     | Test additions or improvements              |
| `### 📝 Docs`      | Documentation changes                       |
| `### 📦 Chores`    | Maintenance, deps, config                   |

### Rules

- Each entry starts with a **bold title** followed by a dash and description
- Entries describe **what changed and why**, not implementation details
- Reference issue numbers where applicable (`Fixes #75`)
- Changesets generates the version header and date — don't add them manually
