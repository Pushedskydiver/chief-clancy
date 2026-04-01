# Contributing to Clancy

Thanks for your interest in contributing to Clancy! This guide covers the basics of setting up the project and submitting changes.

## Prerequisites

- **Node.js 24+** (LTS)
- **pnpm** — installed via `npm i -g pnpm` or [Volta](https://volta.sh/)

## Setup

```bash
git clone git@github.com:Pushedskydiver/chief-clancy.git
cd chief-clancy
pnpm install    # also sets up husky pre-commit hooks
pnpm build
pnpm test
```

## Development workflow

1. Create a branch from `main` (`feature/`, `fix/`, or `chore/`)
2. Make your changes following the [code conventions](docs/CONVENTIONS.md)
3. Write tests — tracer bullet TDD: one test → implement → next test → repeat
4. Pre-commit hooks run ESLint + Prettier automatically on staged `.ts` files
5. Before pushing: `pnpm test && pnpm lint && pnpm typecheck && pnpm format:check`
6. Create a PR — the [PR template](.github/pull_request_template.md) has a checklist

## Commit format

Gitmoji + conventional commit type:

```
<gitmoji> <type>(scope): description
```

| Type       | Gitmoji | Use for                             |
| ---------- | ------- | ----------------------------------- |
| `feat`     | ✨      | New feature                         |
| `fix`      | 🐛      | Bug fix                             |
| `chore`    | 📦      | Maintenance, deps, config           |
| `refactor` | ♻️      | Code change that doesn't fix or add |
| `test`     | ✅      | Adding or updating tests            |
| `docs`     | 📝      | Documentation only                  |

PR titles become squash commit messages — they must follow the same format.

See [docs/GIT.md](docs/GIT.md) for full details.

## Architecture

The monorepo has four packages:

- **`@chief-clancy/core`** — board intelligence, types, lifecycle, pipeline. No terminal/CLI deps.
- **`@chief-clancy/brief`** — standalone brief generator. No core/terminal deps.
- **`@chief-clancy/terminal`** — installer, hooks, CLI bridge. Depends on core.
- **`chief-clancy`** — thin wrapper. `npx chief-clancy` delegates to terminal.

**Dependency direction:** core ← terminal ← wrapper. Brief is standalone. Enforced by ESLint. Core must never import from terminal.

See [docs/CONVENTIONS.md](docs/CONVENTIONS.md) for code standards and [CLAUDE.md](CLAUDE.md) for the full project guide.

## Reporting issues

- **Bugs:** use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md)
- **Features:** use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md)
- **Security:** see [SECURITY.md](SECURITY.md)
