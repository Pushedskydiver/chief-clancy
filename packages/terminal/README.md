# @chief-clancy/terminal

Installer, slash commands, hooks, runners, agents, and Claude CLI bridge for [Clancy](https://github.com/Pushedskydiver/chief-clancy).

[![npm](https://img.shields.io/npm/v/@chief-clancy/terminal?style=for-the-badge&color=cb3837)](https://www.npmjs.com/package/@chief-clancy/terminal) [![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](https://github.com/Pushedskydiver/chief-clancy/blob/main/LICENSE)

> This package is part of the [Clancy monorepo](https://github.com/Pushedskydiver/chief-clancy). You don't install it directly — run `npx chief-clancy` to install Clancy into your project.

## What's in it

### Installer

The install orchestrator that powers `npx chief-clancy`. Copies slash commands, workflows, hooks, and runtime bundles into the user's `.claude/` and `.clancy/` directories. Supports global (`~/.claude`) and local (`./.claude`) installs, SHA-256 manifest tracking for patch preservation, and role-based filtering via `CLANCY_ROLES`.

### Slash commands & workflows

18 slash commands across 5 roles, each backed by a detailed workflow file:

| Role            | Commands                                                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Implementer** | `/clancy:implement`, `/clancy:autopilot`, `/clancy:dry-run`                                                                                                |
| **Reviewer**    | `/clancy:review`, `/clancy:status`, `/clancy:logs`                                                                                                         |
| **Setup**       | `/clancy:init`, `/clancy:settings`, `/clancy:doctor`, `/clancy:map-codebase`, `/clancy:update-docs`, `/clancy:update`, `/clancy:uninstall`, `/clancy:help` |
| **Planner**     | `/clancy:plan`, `/clancy:approve-plan`                                                                                                                     |
| **Strategist**  | `/clancy:brief`, `/clancy:approve-brief`                                                                                                                   |

### Hooks

CJS bundles built by esbuild — best-effort, fail-open, never block the user:

| Hook                      | Event        | Purpose                                                      |
| ------------------------- | ------------ | ------------------------------------------------------------ |
| `clancy-credential-guard` | PreToolUse   | Blocks credential writes to source files                     |
| `clancy-branch-guard`     | PreToolUse   | Blocks force push, protected branch push, destructive resets |
| `clancy-context-monitor`  | PostToolUse  | Context % warnings and time guard                            |
| `clancy-drift-detector`   | PostToolUse  | Warns when runtime files are outdated                        |
| `clancy-statusline`       | Statusline   | Context usage bar and update notices                         |
| `clancy-check-update`     | SessionStart | Background npm version check                                 |
| `clancy-post-compact`     | PostCompact  | Re-injects ticket context after compaction                   |
| `clancy-notification`     | Notification | Native OS desktop notifications                              |

### Runners

Two execution modes powered by the [`@chief-clancy/dev`](https://www.npmjs.com/package/@chief-clancy/dev) pipeline:

- **`runImplement`** — single ticket: fetch, implement, deliver, exit
- **`runAutopilot`** — loop: repeat implement until queue is empty, generate session report

### Agents

Specialist agent prompts (`.md` files) for devil's advocate grilling and verification gates. Codebase scanning agents and the `/clancy:map-codebase` + `/clancy:update-docs` commands come from [`@chief-clancy/scan`](https://www.npmjs.com/package/@chief-clancy/scan).

## Documentation

- [Architecture](../../docs/ARCHITECTURE.md) — full module map and package boundaries
- [Role documentation](../../docs/roles/) — detailed docs for each role
- [Configuration](../../docs/guides/CONFIGURATION.md) — all env vars and settings
- [Testing](../../docs/TESTING.md) — test patterns, E2E setup, CI schedule

## Part of the Clancy monorepo

- [`chief-clancy`](https://www.npmjs.com/package/chief-clancy) — full pipeline (install, configure, implement, autopilot)
- [`@chief-clancy/dev`](https://www.npmjs.com/package/@chief-clancy/dev) — standalone ticket executor
- [`@chief-clancy/scan`](https://www.npmjs.com/package/@chief-clancy/scan) — codebase scanning agents and workflows
- [`@chief-clancy/brief`](https://www.npmjs.com/package/@chief-clancy/brief) — strategic brief generator
- [`@chief-clancy/plan`](https://www.npmjs.com/package/@chief-clancy/plan) — implementation planner
- [`@chief-clancy/core`](https://www.npmjs.com/package/@chief-clancy/core) — board integrations, pipeline phases, schemas

## Credits

Built on the [Ralph technique](https://ghuntley.com/ralph/) by Geoffrey Huntley. See [CREDITS.md](https://github.com/Pushedskydiver/chief-clancy/blob/main/CREDITS.md).

## License

MIT — see [LICENSE](https://github.com/Pushedskydiver/chief-clancy/blob/main/LICENSE).
