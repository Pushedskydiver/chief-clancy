# @chief-clancy/core

Board integrations, schemas, types, and shared utilities for [Clancy](https://github.com/Pushedskydiver/chief-clancy).

[![npm](https://img.shields.io/npm/v/@chief-clancy/core?style=for-the-badge&color=cb3837)](https://www.npmjs.com/package/@chief-clancy/core) [![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](https://github.com/Pushedskydiver/chief-clancy/blob/main/LICENSE)

> This package is part of the [Clancy monorepo](https://github.com/Pushedskydiver/chief-clancy). You don't install it directly — it's a dependency of [`@chief-clancy/dev`](../dev) and [`@chief-clancy/terminal`](../terminal).

## What's in it

### Board integrations

Unified `Board` type abstraction with implementations for 6 platforms:

- **Jira** — REST API v3, JQL queries, ADF description parsing
- **GitHub Issues** — REST API, PR filtering, label management
- **Linear** — GraphQL API, workflow state resolution
- **Shortcut** — REST API v3, workflow state filtering
- **Notion** — REST API, database rows as tickets, property overrides
- **Azure DevOps** — REST API, WIQL queries, work item management

All boards implement the same interface: `ping`, `validateInputs`, `fetchTicket`, `fetchTickets`, `fetchBlockerStatus`, `fetchChildrenStatus`, `transitionTicket`, `ensureLabel`, `addLabel`, `removeLabel`, `sharedEnv`.

### Schemas

`zod/mini` schemas for validating API responses from all 6 board providers and environment configuration from `.clancy/.env`.

### Shared utilities

Cache (`Cached<T>`), HTTP (`fetchAndParse`, `retryFetch`), git operations, remote detection, label helpers, and environment parsing.

## Documentation

- [Architecture](../../docs/ARCHITECTURE.md) — full module map and dependency graph
- [Technical Reference](../../docs/TECHNICAL-REFERENCE.md) — board integration details and gotchas
- [Testing](../../docs/TESTING.md) — test patterns and coverage

## Part of the Clancy monorepo

- [`chief-clancy`](https://www.npmjs.com/package/chief-clancy) — full pipeline (install, configure, implement, autopilot)
- [`@chief-clancy/terminal`](https://www.npmjs.com/package/@chief-clancy/terminal) — installer, slash commands, hooks, runners
- [`@chief-clancy/dev`](https://www.npmjs.com/package/@chief-clancy/dev) — standalone ticket executor
- [`@chief-clancy/scan`](https://www.npmjs.com/package/@chief-clancy/scan) — codebase scanning agents and workflows
- [`@chief-clancy/brief`](https://www.npmjs.com/package/@chief-clancy/brief) — strategic brief generator
- [`@chief-clancy/plan`](https://www.npmjs.com/package/@chief-clancy/plan) — implementation planner

## Credits

Built on the [Ralph technique](https://ghuntley.com/ralph/) by Geoffrey Huntley. See [CREDITS.md](https://github.com/Pushedskydiver/chief-clancy/blob/main/CREDITS.md).

## License

MIT — see [LICENSE](https://github.com/Pushedskydiver/chief-clancy/blob/main/LICENSE).
