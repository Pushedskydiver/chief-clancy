# Architecture

## Overview

Clancy is a monorepo of four npm packages that install Claude Code slash commands, workflows, hooks, and runtime scripts into a user's project. Board logic is implemented in TypeScript ESM modules. Hooks are pre-built CommonJS bundles. Commands and workflows are markdown.

> For visual diagrams of packages, flows, and board interactions, see [VISUAL-ARCHITECTURE.md](VISUAL-ARCHITECTURE.md).

## Packages

```
chief-clancy               — CLI wrapper (npx chief-clancy)
  └── @chief-clancy/terminal  — installer, runner, hooks, commands, agents
        └── @chief-clancy/core   — board integrations, pipeline, lifecycle, schemas

@chief-clancy/brief        — standalone brief generator (no core/terminal deps)
```

**Dependency direction: core <- terminal <- chief-clancy.** Brief is standalone (no deps on core or terminal). No reverse imports. Enforced by `eslint-plugin-boundaries`.

| Package                  | Purpose                                                            | Published      |
| ------------------------ | ------------------------------------------------------------------ | -------------- |
| `chief-clancy`           | Thin bin wrapper — resolves paths, wires `runInstall`              | Yes (unscoped) |
| `@chief-clancy/terminal` | Installer, hooks, runners, slash commands, agents                  | Yes            |
| `@chief-clancy/core`     | Board abstractions, pipeline phases, lifecycle modules, schemas    | Yes            |
| `@chief-clancy/brief`    | Standalone brief generator — slash command + lightweight installer | Yes            |

## Directory Structure

```
@chief-clancy/
├── packages/
│   ├── core/                        — @chief-clancy/core
│   │   └── src/
│   │       ├── board/               — 6 board providers + factory + detect-board
│   │       │   ├── github/          — api, labels, relations
│   │       │   ├── jira/
│   │       │   ├── linear/
│   │       │   ├── shortcut/
│   │       │   ├── notion/
│   │       │   ├── azdo/
│   │       │   ├── detect-board.ts  — auto-detect provider from env
│   │       │   └── factory/         — createBoard() — single switch on provider
│   │       ├── schemas/             — Zod/mini schemas for API responses + env vars
│   │       ├── types/               — shared type definitions
│   │       ├── shared/              — utility modules
│   │       │   ├── cache/           — Cached<T>, CachedMap<K,V>
│   │       │   ├── env-parser/      — .clancy/.env loader
│   │       │   ├── git-ops/         — checkout, branch detection, push
│   │       │   ├── git-token/       — resolveGitToken
│   │       │   ├── http/            — fetchAndParse, retryFetch, ping
│   │       │   ├── label-helpers/   — modifyLabelList, safeLabel
│   │       │   └── remote/          — parseRemote, detectRemote
│   │       └── dev/                 — development pipeline + lifecycle
│   │           ├── pipeline/        — phase orchestrator + 13 phase directories
│   │           │   ├── context.ts   — RunContext type
│   │           │   ├── run-pipeline.ts
│   │           │   └── phases/      — lock-check → cleanup
│   │           └── lifecycle/       — ticket-lifecycle modules
│   │               ├── branch/      — branch naming + computation
│   │               ├── lock/        — lock file management
│   │               ├── deliver-ticket/ — PR delivery
│   │               ├── deliver-epic/   — epic PR delivery
│   │               ├── rework/      — PR review → rework cycle
│   │               ├── fetch-ticket/— ticket fetch + blocker filtering
│   │               └── ...          — cost, epic, feasibility, format, outcome,
│   │                                  pr-creation, preflight, progress,
│   │                                  pull-request, quality, resume, commit-type
│   ├── terminal/                    — @chief-clancy/terminal
│   │   └── src/
│   │       ├── installer/           — install orchestrator
│   │       │   ├── install/         — runInstall, resolveInstallPaths, parseInstallFlag
│   │       │   ├── file-ops/        — copy, inline workflows
│   │       │   ├── hook-installer/  — settings.json registration
│   │       │   ├── manifest/        — SHA-256 checksums for patch preservation
│   │       │   ├── prompts/         — interactive CLI prompts
│   │       │   ├── role-filter/     — optional role filtering via CLANCY_ROLES
│   │       │   └── ui/              — banner, success output
│   │       ├── runner/              — execution engine
│   │       │   ├── autopilot/       — AFK loop runner
│   │       │   ├── implement/       — single-ticket runner
│   │       │   ├── dep-factory/     — dependency injection wiring
│   │       │   ├── prompt-builder/  — prompt generation for Claude sessions
│   │       │   └── session-report/  — AFK session summary
│   │       ├── hooks/               — CJS hook bundles (esbuild)
│   │       │   ├── clancy-credential-guard/  — PreToolUse: blocks credential writes
│   │       │   ├── clancy-branch-guard/      — PreToolUse: blocks force push + destructive resets
│   │       │   ├── clancy-context-monitor/   — PostToolUse: context % + time guard warnings
│   │       │   ├── clancy-statusline/        — Statusline: context bar + update notice
│   │       │   ├── clancy-check-update/      — SessionStart: background npm version check
│   │       │   ├── clancy-post-compact/      — PostCompact: re-injects ticket context
│   │       │   ├── clancy-notification/      — Notification: native OS desktop notifications
│   │       │   ├── clancy-drift-detector/    — PostToolUse: warns on outdated runtime files
│   │       │   └── shared/                   — hook utilities (hasErrorCode, isPlainObject)
│   │       ├── roles/               — commands + workflows by role
│   │       │   ├── setup/           — init, settings, doctor, help
│   │       │   ├── implementer/     — implement, autopilot, dry-run
│   │       │   └── reviewer/        — review, status, logs
│   │       │   (planner and strategist are virtual roles — their slash commands live in @chief-clancy/plan and @chief-clancy/brief)
│   │       ├── agents/              — specialist agent prompts (.md)
│   │       ├── templates/           — CLAUDE.md template, .env.example per board
│   │       └── shared/              — ANSI colour helpers
│   ├── brief/                       — @chief-clancy/brief (standalone)
│   │   ├── bin/brief.js             — ESM entry point with shebang
│   │   └── src/
│   │       ├── installer/           — self-contained installer (no core/terminal deps)
│   │       ├── commands/            — brief.md, approve-brief.md, board-setup.md slash commands
│   │       ├── workflows/           — brief.md, approve-brief.md, board-setup.md workflows
│   │       └── agents/              — devils-advocate.md (AI-grill agent)
│   └── chief-clancy/               — chief-clancy (CLI wrapper)
│       ├── bin/clancy.js            — ESM entry point with shebang
│       └── package.json             — bin field, depends on @chief-clancy/terminal
├── docs/                            — project documentation
├── scripts/                         — build/utility scripts (group-changelog)
└── .github/workflows/               — CI, E2E, CodeQL, publish
```

The two virtual roles (`planner`, `strategist`) have no on-disk directory in `terminal/src/roles/` — they're config-key concepts in `installer/ui.ts` `COMMAND_GROUPS` and the `*-content.ts` install gates, with their slash commands living in the standalone packages. See [docs/roles/PLANNER.md](roles/PLANNER.md) and [docs/roles/STRATEGIST.md](roles/STRATEGIST.md) for the virtual-role pattern and the three install modes each command supports.

## How the Installer Works

`packages/chief-clancy/bin/clancy.js` is the entry point for `npx chief-clancy`. It resolves the `@chief-clancy/terminal` package on disk and delegates to `runInstall`:

1. Prompts for global (`~/.claude`) or local (`./.claude`) install (or reads `--global`/`--local` flag)
2. Walks `roles/*/commands/` and copies command files flat to `{dest}/commands/clancy/`
   - Core roles (implementer, reviewer, setup) are always installed
   - Optional roles (planner, strategist) are only installed if listed in `CLANCY_ROLES` env var in `.clancy/.env`, or if no `.clancy/.env` exists yet (first install = install all)
3. Walks `roles/*/workflows/` and copies workflow files flat to `{dest}/clancy/workflows/`
4. Copies hook bundles (`dist/hooks/*.js`) to `{dest}/hooks/`
5. Copies bundled runtime scripts (`dist/bundle/clancy-implement.js`, `clancy-autopilot.js`) to `.clancy/`
6. Registers hooks in Claude's `settings.json` (PreToolUse, PostToolUse, SessionStart, Statusline)
7. Writes `{"type":"commonjs"}` package.json into hooks dir (ESM compatibility)
8. Generates SHA-256 manifests for patch preservation on future updates
9. For global installs: inlines workflow content into command files (`@` paths don't resolve globally)

## Command and Workflow Relationship

Commands are thin wrappers. Each command file references a workflow:

```
/clancy:implement  ->  roles/implementer/commands/implement.md  ->  @clancy/workflows/implement.md
```

Commands are user-facing (appear in Claude Code's `/` menu). Workflows contain the actual implementation logic and are never exposed directly.

## Phase Pipeline

The pipeline orchestrator (`dev/src/pipeline/run-pipeline.ts`) runs a sequence of composable phases:

```
RunContext (mutable shared state)
  |
  +-- lock-check       — startup lock, stale detection, AFK resume
  +-- preflight        — env, board detection, validation, ping, banner
  +-- epic-completion  — scan for completed epics -> auto-create epic PR
  +-- pr-retry         — retry PR creation for PUSHED tickets (network recovery)
  +-- rework-detection — PR review feedback -> rework ticket
  +-- ticket-fetch     — fetch unblocked ticket, compute branches
  +-- dry-run          — print preview and exit if --dry-run
  +-- feasibility      — can this be implemented as code?
  +-- branch-setup     — git ops (epic branch, feature branch, lock write)
  +-- transition       — move ticket to In Progress
  +-- deliver          — push branch, create PR, log progress
  +-- cost             — duration-based token estimate -> costs.log
  +-- cleanup          — completion print, webhook notification
```

The Claude session invocation (prompt building, CLI bridge) lives in `terminal/runner/`, not in the core pipeline. Each phase has signature `(ctx: RunContext) => Promise<boolean> | boolean`. Returns `true` to continue, `false` for early exit.

## Runner Modes

The terminal package provides two runner entry points:

| Runner         | Entry               | Purpose                                                                  |
| -------------- | ------------------- | ------------------------------------------------------------------------ |
| `runImplement` | `runner/implement/` | Single ticket — fetch, implement, deliver, exit                          |
| `runAutopilot` | `runner/autopilot/` | Loop — repeat implement until no tickets remain, generate session report |

Both use `buildPipelineDeps` (`runner/dep-factory/`) to wire real dependencies (fs, git, Claude CLI) into the pipeline phases.

## Board Type Abstraction

All board operations go through a unified `Board` type (`core/types/`):

| Method                                                         | Purpose                                        |
| -------------------------------------------------------------- | ---------------------------------------------- |
| `ping()`                                                       | Connectivity + credential check                |
| `validateInputs()`                                             | Board-specific input validation                |
| `fetchTicket(opts)`                                            | Fetch a single ticket from the queue           |
| `fetchTickets(opts)`                                           | Fetch multiple candidates (batch/filtering)    |
| `fetchBlockerStatus(ticket)`                                   | Check if blocking dependencies are resolved    |
| `fetchChildrenStatus(parentKey, parentId?, currentTicketKey?)` | Epic completion detection                      |
| `transitionTicket(ticket, status)`                             | Move ticket to target state                    |
| `ensureLabel(label)`                                           | Create label on board if missing               |
| `addLabel(issueKey, label)`                                    | Add label to issue                             |
| `removeLabel(issueKey, label)`                                 | Remove label from issue                        |
| `sharedEnv()`                                                  | Board-specific env vars for downstream modules |

`createBoard(config)` in `core/board/factory/` is the single switch on `config.provider`. Supports: GitHub, Jira, Linear, Shortcut, Notion, Azure DevOps.

## Hook Architecture

Hook bundles run at different points in the Claude Code lifecycle:

| Hook                      | Event        | Purpose                                                                      |
| ------------------------- | ------------ | ---------------------------------------------------------------------------- |
| `clancy-credential-guard` | PreToolUse   | Scans Write/Edit/MultiEdit for credentials, blocks if found                  |
| `clancy-branch-guard`     | PreToolUse   | Blocks force push, protected branch push, destructive resets                 |
| `clancy-context-monitor`  | PostToolUse  | Reads bridge file, injects warning when context <= 35% + time guard warnings |
| `clancy-statusline`       | Statusline   | Writes context metrics to bridge file, renders status bar                    |
| `clancy-check-update`     | SessionStart | Spawns background process to check npm for updates                           |
| `clancy-post-compact`     | PostCompact  | Re-injects ticket context after context compaction                           |
| `clancy-notification`     | Notification | Native OS desktop notifications                                              |
| `clancy-drift-detector`   | PostToolUse  | Warns when runtime files are outdated (debounced)                            |

Hooks are CommonJS bundles built by esbuild (`hooks/esbuild.hooks.ts`). They are best-effort — catch all errors and exit cleanly rather than blocking the user. The statusline and context monitor communicate via a bridge file in `$TMPDIR`.

## Role Lifecycle: Planner

```
Backlog ticket
  |
  v
/clancy:plan --- preflight -> fetch from planning queue -> explore codebase -> generate plan -> post as comment
  |
  v
Human reviews plan on the board
  |
  +- Approves -> /clancy:approve-plan {KEY} -> plan promoted to description -> ticket transitioned -> ready for /clancy:implement
  |
  +- Rejects (leaves feedback) -> /clancy:plan -> auto-detects feedback, generates improved plan
```

Planner and implementer work on separate queues. They never compete for the same tickets.

## Role Lifecycle: Strategist

```
Vague idea (ticket / text / file)
  |
  v
/clancy:brief --- parse input -> grill phase -> research -> generate brief -> save to .clancy/briefs/
  |
  v
Human reviews brief
  |
  +- Approves -> /clancy:approve-brief -> topo-sort -> create tickets on board -> link dependencies
  |
  +- Leaves feedback -> /clancy:brief -> auto-detects feedback, revises brief
```

Grill modes: **human grill** (default, interactive Q&A) or **AI grill** (`--afk`, devil's advocate agent interrogates codebase, board, and web autonomously).

## What Gets Created in User Projects

After `/clancy:init` + `/clancy:map-codebase`:

```
.clancy/
  clancy-implement.js        — bundled once orchestrator (self-contained)
  clancy-autopilot.js         — bundled AFK loop runner (self-contained)
  docs/                 — structured docs (read before every run)
  progress.txt          — append-only completion log
  costs.log             — duration-based token cost estimates per ticket
  lock.json             — lock file for crash recovery (transient)
  session-report.md     — AFK session summary (generated after /clancy:autopilot)
  .env                  — board credentials (gitignored)
  .env.example          — credential template
```

Plus a `<!-- clancy:start -->` / `<!-- clancy:end -->` block in the project's `CLAUDE.md`.

## Build System

| Tool            | Purpose                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------- |
| pnpm workspaces | Package management, workspace linking                                                             |
| Turbo           | Parallel builds, test caching, task orchestration                                                 |
| tsc + tsc-alias | TypeScript compilation, path alias rewriting (`~/c/` -> `core/src/*`, `~/t/` -> `terminal/src/*`) |
| esbuild         | Hook CJS bundling (8 self-contained bundles, zero npm deps)                                       |
| Vitest          | Unit + integration testing                                                                        |
| Changesets      | Version management + npm publishing                                                               |

## Validation

- `zod/mini` for all runtime validation (not full `zod`)
- Schemas in `core/schemas/` validate API responses from all 6 board providers
- Environment schemas validate `.clancy/.env` configuration
- `publint` and `@arethetypeswrong/cli` validate package publishability
- `knip` detects unused exports and dead code
