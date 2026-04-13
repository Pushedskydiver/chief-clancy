# Clancy

**Autonomous development for Claude Code — driven by your Kanban board, or by local plan files.**

[![npm](https://img.shields.io/npm/v/chief-clancy?style=for-the-badge&color=cb3837)](https://www.npmjs.com/package/chief-clancy) [![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](https://github.com/Pushedskydiver/chief-clancy/blob/main/LICENSE)

```bash
npx chief-clancy
```

> [!WARNING]
> Clancy is in early development. Expect breaking changes and rough edges.

Clancy scaffolds slash commands, hooks, and board integrations into your Claude Code project. It picks up tickets from your Kanban board (Jira, GitHub Issues, Linear, Shortcut, Notion, or Azure DevOps), implements them autonomously, and creates pull requests. Also supports local plan execution via `--from` — no board needed.

## How it works

**With a board:**

1. **Install:** `npx chief-clancy` — choose global or local install
2. **Configure:** `/clancy:init` — connect your board, enter credentials
3. **Scan:** `/clancy:map-codebase` — 5 parallel agents document your codebase
4. **Run:** `/clancy:implement` — pick up one ticket, implement, create PR
5. **Go AFK:** `/clancy:autopilot` — loop through your backlog unattended

**Without a board — local plan-driven flow:**

1. **Install:** `npx chief-clancy`
2. **Configure:** `/clancy:init` — answer "No" when asked about a board
3. **Scan:** `/clancy:map-codebase`
4. **Draft:** `/clancy:brief --from outline.md` → `/clancy:plan --from <brief>` → `/clancy:approve-plan <plan>`
5. **Run one plan:** `/clancy:implement --from .clancy/plans/<plan>.md`
6. **Go AFK:** `/clancy:implement --from .clancy/plans/ --afk` — batch-executes every approved plan

## Packages

This is the CLI entry point for the [Clancy monorepo](https://github.com/Pushedskydiver/chief-clancy). It delegates to:

- [`@chief-clancy/core`](https://www.npmjs.com/package/@chief-clancy/core) — board integrations, schemas, shared utilities
- [`@chief-clancy/terminal`](https://www.npmjs.com/package/@chief-clancy/terminal) — installer, slash commands, hooks, runners
- [`@chief-clancy/dev`](https://www.npmjs.com/package/@chief-clancy/dev) — standalone ticket executor
- [`@chief-clancy/scan`](https://www.npmjs.com/package/@chief-clancy/scan) — codebase scanning agents and workflows
- [`@chief-clancy/brief`](https://www.npmjs.com/package/@chief-clancy/brief) — strategic brief generator
- [`@chief-clancy/plan`](https://www.npmjs.com/package/@chief-clancy/plan) — implementation planner

## Documentation

- [Getting started](https://github.com/Pushedskydiver/chief-clancy#getting-started)
- [Commands](https://github.com/Pushedskydiver/chief-clancy#commands)
- [Configuration](https://github.com/Pushedskydiver/chief-clancy/blob/main/docs/guides/CONFIGURATION.md)
- [Security](https://github.com/Pushedskydiver/chief-clancy/blob/main/docs/guides/SECURITY.md)
- [Troubleshooting](https://github.com/Pushedskydiver/chief-clancy/blob/main/docs/guides/TROUBLESHOOTING.md)

## Credits

Built on the [Ralph technique](https://ghuntley.com/ralph/) by Geoffrey Huntley. See [CREDITS.md](https://github.com/Pushedskydiver/chief-clancy/blob/main/CREDITS.md).

## License

MIT — see [LICENSE](https://github.com/Pushedskydiver/chief-clancy/blob/main/LICENSE).
