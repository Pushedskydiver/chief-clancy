# @chief-clancy/core

Board integrations, pipeline phases, ticket lifecycle modules, schemas, and shared utilities for [Clancy](https://github.com/Pushedskydiver/chief-clancy).

[![npm](https://img.shields.io/npm/v/@chief-clancy/core?style=for-the-badge&color=cb3837)](https://www.npmjs.com/package/@chief-clancy/core) [![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](../../LICENSE)

> This package is part of the [Clancy monorepo](https://github.com/Pushedskydiver/chief-clancy). You don't install it directly — it's a dependency of [`@chief-clancy/terminal`](../terminal).

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

### Pipeline phases

The phase orchestrator runs a sequence of composable phases that take a ticket from fetch to delivery:

`lock-check` → `preflight` → `epic-completion` → `pr-retry` → `rework-detection` → `ticket-fetch` → `dry-run` → `feasibility` → `branch-setup` → `transition` → `deliver` → `cost` → `cleanup`

### Lifecycle modules

Focused modules for each concern in the ticket lifecycle: branching, locking, PR creation (GitHub/GitLab/Bitbucket/Azure DevOps), rework detection, epic delivery, cost tracking, progress logging, crash recovery, and more.

### Schemas

`zod/mini` schemas for validating API responses from all 6 board providers and environment configuration from `.clancy/.env`.

### Shared utilities

Cache (`Cached<T>`), HTTP (`fetchAndParse`, `retryFetch`), git operations, remote detection, label helpers, and environment parsing.

## Documentation

- [Architecture](../../docs/ARCHITECTURE.md) — full module map and dependency graph
- [Technical Reference](../../docs/TECHNICAL-REFERENCE.md) — board integration details and gotchas
- [Testing](../../docs/TESTING.md) — test patterns and coverage

## License

MIT — see [LICENSE](../../LICENSE).
