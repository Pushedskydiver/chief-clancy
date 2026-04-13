# @chief-clancy/scan

**Codebase scanning agents and workflows for Claude Code.**

[![npm](https://img.shields.io/npm/v/@chief-clancy/scan?style=for-the-badge&color=cb3837)](https://www.npmjs.com/package/@chief-clancy/scan) [![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](https://github.com/Pushedskydiver/chief-clancy/blob/main/LICENSE)

Shared package containing the 5 specialist scanning agents and the `map-codebase` / `update-docs` commands and workflows. Consumed by [`@chief-clancy/brief`](https://www.npmjs.com/package/@chief-clancy/brief), [`@chief-clancy/plan`](https://www.npmjs.com/package/@chief-clancy/plan), [`@chief-clancy/dev`](https://www.npmjs.com/package/@chief-clancy/dev), [`@chief-clancy/terminal`](https://www.npmjs.com/package/@chief-clancy/terminal), and [`chief-clancy`](https://www.npmjs.com/package/chief-clancy).

## What it contains

### Agents

Five parallel specialist agents that scan your codebase and write structured docs to `.clancy/docs/`:

| Agent    | Docs written                                                      |
| -------- | ----------------------------------------------------------------- |
| tech     | `STACK.md`, `INTEGRATIONS.md`                                     |
| arch     | `ARCHITECTURE.md`                                                 |
| quality  | `CONVENTIONS.md`, `TESTING.md`, `GIT.md`, `DEFINITION-OF-DONE.md` |
| design   | `DESIGN-SYSTEM.md`, `ACCESSIBILITY.md`                            |
| concerns | `CONCERNS.md`                                                     |

### Commands

- `/clancy:map-codebase` — run all 5 agents simultaneously (~2 minutes)
- `/clancy:update-docs` — incrementally refresh only the docs affected by recent changes

## Usage

This package is not installed directly. Install any consuming package and the scan commands are included automatically:

```bash
npx @chief-clancy/brief    # includes map-codebase + update-docs
npx @chief-clancy/plan     # includes map-codebase + update-docs
npx @chief-clancy/dev      # includes map-codebase + update-docs
npx chief-clancy            # includes everything
```

## Part of the Clancy monorepo

- [`chief-clancy`](https://www.npmjs.com/package/chief-clancy) — full pipeline (install, configure, implement, autopilot)
- [`@chief-clancy/core`](https://www.npmjs.com/package/@chief-clancy/core) — board integrations, schemas, shared utilities
- [`@chief-clancy/terminal`](https://www.npmjs.com/package/@chief-clancy/terminal) — installer, slash commands, hooks, runners
- [`@chief-clancy/dev`](https://www.npmjs.com/package/@chief-clancy/dev) — standalone ticket executor
- [`@chief-clancy/brief`](https://www.npmjs.com/package/@chief-clancy/brief) — strategic brief generator
- [`@chief-clancy/plan`](https://www.npmjs.com/package/@chief-clancy/plan) — implementation planner

## Credits

Built on the [Ralph technique](https://ghuntley.com/ralph/) by Geoffrey Huntley. See [CREDITS.md](https://github.com/Pushedskydiver/chief-clancy/blob/main/CREDITS.md).

## License

MIT — see [LICENSE](https://github.com/Pushedskydiver/chief-clancy/blob/main/LICENSE).
