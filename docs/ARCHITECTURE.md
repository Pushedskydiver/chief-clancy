# Architecture

## Overview

Clancy is a monorepo of seven npm packages that install Claude Code slash commands, workflows, hooks, and runtime scripts into a user's project. Board logic is implemented in TypeScript ESM modules. Hooks are pre-built CommonJS bundles. Commands and workflows are markdown.

> For visual diagrams of packages, flows, and board interactions, see [VISUAL-ARCHITECTURE.md](VISUAL-ARCHITECTURE.md).

## Packages

```
chief-clancy                  — CLI wrapper (npx chief-clancy)
  └── @chief-clancy/terminal  — installer, runner, hooks, commands, agents
        └── @chief-clancy/core   — board integrations, schemas, shared utilities

Standalone packages (own npx entry points, install independently of terminal):
@chief-clancy/scan            — no package deps
@chief-clancy/brief           — depends on scan
@chief-clancy/plan            — depends on scan
@chief-clancy/dev             — depends on core + scan (ticket executor runtime)
```

**Dependency direction: core ← terminal ← chief-clancy.** The standalone packages each have their own `npx @chief-clancy/{pkg}` entry point. `scan` has no package deps; `brief` and `plan` depend on `scan`; `dev` depends on `core` and `scan`. No reverse imports. Enforced by `eslint-plugin-boundaries`.

| Package                  | Purpose                                                                                               | Published      |
| ------------------------ | ----------------------------------------------------------------------------------------------------- | -------------- |
| `chief-clancy`           | Thin bin wrapper — resolves paths, wires `runInstall`                                                 | Yes (unscoped) |
| `@chief-clancy/terminal` | Installer, hooks, runners, slash commands, agents                                                     | Yes            |
| `@chief-clancy/core`     | Board abstractions, schemas (Zod/mini), shared utilities (cache, http, git-ops, env-parser)           | Yes            |
| `@chief-clancy/scan`     | Standalone codebase-scan commands + specialist agents (`/clancy:map-codebase`, `/clancy:update-docs`) | Yes            |
| `@chief-clancy/brief`    | Standalone brief generator — `/clancy:brief`, `/clancy:approve-brief`, `/clancy:board-setup`          | Yes            |
| `@chief-clancy/plan`     | Standalone planner — `/clancy:plan`, `/clancy:approve-plan` (writes `.approved` marker in local mode) | Yes            |
| `@chief-clancy/dev`      | Standalone executor — pipeline phases, lifecycle modules, esbuild runtime bundles for `.clancy/`      | Yes            |

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
│   ├── dev/                         — @chief-clancy/dev
│   │   └── src/
│   │       ├── pipeline/            — phase orchestrator + 13 phase directories
│   │       ├── lifecycle/           — 19 ticket-lifecycle modules
│   │       ├── artifacts/           — readiness-report, run-summary, deferred, drift, atomic-write
│   │       ├── queue.ts             — executeQueue + executeFixedCount loop primitives
│   │       ├── agents/              — readiness rubric + verdict parser
│   │       ├── execute/             — single-ticket executor + readiness gate
│   │       ├── entrypoints/         — dev.ts, loop.ts (esbuild entry points)
│   │       └── installer/           — standalone installer (bin/dev.js)
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

Runs on two parallel paths depending on whether the source is a board ticket or a local brief file.

**Board path:**

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

**Local path (`--from`):**

```
Brief file in .clancy/briefs/
  |
  v
/clancy:plan --from {brief} --- read brief -> explore codebase -> generate plan -> write .clancy/plans/{plan-id}.md
  |
  v
Human reviews plan file
  |
  +- Approves -> /clancy:approve-plan {plan-stem-or-path}
  |               -> compute SHA-256 of plan file
  |               -> write sibling .clancy/plans/{plan-id}.approved marker (sha256= + approved_at=) via O_EXCL
  |               -> ready for /clancy:implement --from .clancy/plans/{plan-id}.md
  |
  +- Leaves feedback -> /clancy:plan --from -> auto-detects feedback, revises plan
```

The `.approved` marker is a **write-side contract today** — `/clancy:approve-plan` writes it correctly (SHA-256 + timestamp via `O_EXCL`), but runtime enforcement is deferred per `packages/plan/src/workflows/approve-plan.md:412-418`. The verifier function `checkApprovalStatus` exists at `packages/dev/src/lifecycle/plan-file/plan-file.ts:144` but has no callers in the pipeline today. `runLocalMode` in `packages/dev/src/entrypoints/dev.ts:168` runs `--from` plans without checking the marker. Until the verifier is wired, approval is a workflow-level convention — the user (or Claude Code via natural-language instruction) reads the marker and refuses to apply on mismatch.

Planner and implementer work on separate queues (board path) or separate plan-file states (local path). They never compete for the same work.

## Role Lifecycle: Strategist

Runs on two parallel paths.

**Board path:**

```
Vague idea (ticket / text / file)
  |
  v
/clancy:brief --- parse input -> grill phase -> research -> generate brief -> save to .clancy/briefs/ -> post on ticket
  |
  v
Human reviews brief
  |
  +- Approves -> /clancy:approve-brief -> topo-sort -> create tickets on board -> link dependencies
  |
  +- Leaves feedback -> /clancy:brief -> auto-detects feedback, revises brief
```

**Local path (`--from`):**

```
Outline file (any local .md)
  |
  v
/clancy:brief --from {outline} --- parse -> grill -> research -> write .clancy/briefs/{slug}.md
  |
  v
Human reviews brief file
  |
  +- Happy -> continue to /clancy:plan --from (no approve-brief step — local path skips ticket creation)
  |
  +- Leaves feedback in ## Feedback section -> /clancy:brief --from -> auto-detects feedback, revises brief
```

Only the board path has `/clancy:approve-brief` (its job is to create tickets on a board). The local path skips that step and goes directly to `/clancy:plan --from` once the brief is satisfactory.

Grill modes: **human grill** (default, interactive Q&A) or **AI grill** (`--afk`, devil's advocate agent interrogates codebase, board, and web autonomously).

## Two Directory Trees

Clancy uses two separate directory trees in user projects. The split is load-bearing — putting files in the wrong tree breaks either Claude Code discovery or Node.js execution.

| Directory  | Owner                    | Purpose                                                                                                                           |
| ---------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `.claude/` | Claude Code              | Slash commands, workflows, agents, hooks. Claude Code discovers and serves these. Global (`~/.claude/`) or local (`./.claude/`).  |
| `.clancy/` | Node.js / Clancy runtime | Board credentials, executable bundles, plans, briefs, lock files, logs. Always project-relative (`<cwd>/.clancy/`), never global. |

**Rule:** Markdown files that Claude reads → `.claude/`. Scripts that Node.js executes → `.clancy/`. Credentials and project state → `.clancy/`.

Every package follows this:

- **brief, plan** install commands + workflows to `.claude/` only (no bundles)
- **dev** installs commands + workflows to `.claude/`, bundles to `.clancy/`
- **terminal** installs commands + workflows + hooks to `.claude/`, bundles to `.clancy/`
- **core** has no installer (library only)

## What Gets Created in User Projects

After running the installers:

```
.claude/
  commands/clancy/            — slash command files (brief, plan, dev, terminal)
  clancy/workflows/           — workflow markdown (brief, plan, dev, terminal)
  clancy/agents/              — agent prompts (brief, terminal)
  clancy/hooks/               — Claude Code hooks (terminal)

.clancy/
  clancy-implement.js         — bundled implement orchestrator (terminal)
  clancy-autopilot.js         — bundled AFK loop runner (terminal)
  clancy-dev.js               — bundled dev executor (dev)
  clancy-dev-autopilot.js     — bundled dev AFK runner (dev)
  package.json                — {"type":"module"} for ESM bundle execution
  plans/                      — local plan files
  briefs/                     — local brief files
  docs/                       — structured docs (read before every run)
  progress.txt                — append-only completion log
  costs.log                   — duration-based token cost estimates per ticket
  lock.json                   — lock file for crash recovery (transient)
  session-report.md           — AFK session summary (after /clancy:autopilot)
  .env                        — board credentials (gitignored)
  .env.example                — credential template
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
