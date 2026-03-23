# Glossary

Ubiquitous language for the Clancy project. Use these terms consistently in code, docs, commits, and agent prompts.

## Monorepo

| Term                      | Definition                                                                                                                                                                                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core**                  | The `@chief-clancy/core` package. Domain model (boards, types, schemas) plus capability directories (dev, brief, plan, design, qa) that will become separate packages when extraction criteria are met.                                                   |
| **Terminal**              | The `@chief-clancy/terminal` package. CLI installer, slash commands, hooks, agents, templates, plus automate directory (future package). Depends on core.                                                                                                 |
| **Wrapper**               | The `chief-clancy` package. Thin bin entry point that delegates to terminal. What users install via `npx chief-clancy`.                                                                                                                                   |
| **Capability directory**  | A directory inside core or terminal that maps to a future package (`dev/`, `brief/`, `plan/`, `design/`, `qa/`, `automate/`). Internal import boundaries enforced now; extracted into a package when a second consumer proves the need.                   |
| **Extraction criteria**   | When to promote a capability directory to its own package: a second consumer exists, the directory exceeds 2000 lines, or it needs independent release cadence.                                                                                           |
| **Workspace**             | A pnpm workspace — each directory under `packages/` is a workspace with its own `package.json`.                                                                                                                                                           |
| **Barrel export**         | An `index.ts` file that re-exports the public API of a module or package. Controls what is importable from outside.                                                                                                                                       |
| **Dependency direction**  | Core ← terminal ← wrapper. Core imports nothing from terminal. Terminal imports from core only. Enforced by eslint-plugin-boundaries.                                                                                                                     |
| **Changeset**             | A file describing a version bump and changelog entry, managed by `@changesets/cli`. Created with `pnpm changeset`.                                                                                                                                        |
| **Phase validation**      | Protocol run before starting each delivery phase. Two agents (breakdown validator + DA) review the PR list for scope, ordering, and risk.                                                                                                                 |
| **Invoke strategy**       | The pattern where core's pipeline defines pure phases, but the actual Claude CLI invocation is terminal's responsibility. Core returns what to invoke; terminal executes it.                                                                              |
| **DA (devil's advocate)** | A review agent spun up as a subagent to challenge code, docs, or plans. Runs in a fresh context (not biased by having written the code). Used at phase validation, PR completion, and pre-merge. Findings are graded by severity — medium+ must be fixed. |
| **Tracer bullet TDD**     | The project's TDD approach: write one test → implement to pass → next test → repeat → refactor. Vertical slices, not horizontal. Never write all tests first then all implementation — tests written in bulk test imagined behaviour.                     |

## Roles

| Term            | Definition                                                                                                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Implementer** | Core role. Picks up tickets from the board, implements them, delivers via PR. Commands: `/clancy:once`, `/clancy:run`, `/clancy:dry-run`.                                                                       |
| **Reviewer**    | Core role. Reviews completed work, checks quality, manages logs. Commands: `/clancy:review`, `/clancy:status`, `/clancy:logs`.                                                                                  |
| **Setup**       | Core role. Configuration and maintenance. Commands: `/clancy:init`, `/clancy:settings`, `/clancy:doctor`, `/clancy:update`, `/clancy:map-codebase`, `/clancy:update-docs`, `/clancy:uninstall`, `/clancy:help`. |
| **Planner**     | Optional role. Generates implementation plans for tickets before coding begins. Commands: `/clancy:plan`, `/clancy:approve-plan`.                                                                               |
| **Strategist**  | Optional role. Decomposes vague ideas into actionable tickets via research and stakeholder grilling. Commands: `/clancy:brief`, `/clancy:approve-brief`.                                                        |

## Delivery

| Term                  | Definition                                                                                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Board**             | The project management tool (Jira, GitHub Issues, Linear, Shortcut, Notion, Azure DevOps) where tickets live. Clancy reads from and writes to the board via API.                                      |
| **Ticket**            | A unit of work on the board. Clancy fetches, implements, and transitions tickets.                                                                                                                     |
| **Parented ticket**   | A ticket that has a parent (epic in Jira, milestone in GitHub, parent issue in Linear). Delivered via PR to the epic branch.                                                                          |
| **Standalone ticket** | A ticket with no parent. Delivered via PR directly to the base branch.                                                                                                                                |
| **Epic branch**       | A long-lived branch where child ticket PRs are merged. Named `epic/{key}` for Jira/Linear or `milestone/{slug}` for GitHub. When all children are done, the epic branch gets a PR to the base branch. |
| **Base branch**       | The branch configured as `CLANCY_BASE_BRANCH` (default: `main`). The target for standalone ticket PRs and epic PRs.                                                                                   |
| **Feature branch**    | A short-lived branch (e.g. `feature/proj-101`) created for implementing a single ticket. PRs target either the epic branch or base branch.                                                            |
| **Single-child skip** | Optimisation: if an epic has only one child ticket, skip the epic branch overhead — deliver the child PR directly to the base branch.                                                                 |
| **Epic completion**   | When all children of an epic are done (PRs merged), Clancy auto-creates a PR from the epic branch to the base branch.                                                                                 |
| **Migration guard**   | Safety check: if an epic branch exists locally but not on the remote, block and show instructions to push manually.                                                                                   |

## Once Orchestrator

| Term                  | Definition                                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Once**              | A single ticket execution cycle: preflight → fetch ticket → implement → deliver → log. Entry point: `/clancy:once`.                            |
| **Run**               | AFK loop that calls once repeatedly until the queue is empty or `MAX_ITERATIONS` is reached. Entry point: `/clancy:run`.                       |
| **Preflight**         | Startup checks: `.clancy/.env` exists, credentials valid, board reachable. Runs before every ticket.                                           |
| **Blocker check**     | Before implementing, check blocking dependencies on the board. If any blocker is incomplete, the ticket is skipped.                            |
| **Board type**        | Unified type abstracting all board operations. Created by `createBoard()` factory — the single switch on `config.provider` in the system.      |
| **Phase pipeline**    | The once orchestrator is a pipeline of 13 composable phase functions sharing a `RunContext`. Each phase returns continue or exit.              |
| **Feasibility check** | After fetching a ticket, assess whether the work is achievable in the current codebase context.                                                |
| **Rework**            | Automatic re-implementation triggered by PR review comments. Inline code comments always trigger; conversation comments need `Rework:` prefix. |
| **Progress entry**    | A line in `.clancy/progress.txt` recording a completed action.                                                                                 |
| **TDD mode**          | Test-driven development mode enabled by `CLANCY_TDD=true`.                                                                                     |

## Strategist

| Term               | Definition                                                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Brief**          | A strategic decomposition document generated by `/clancy:brief`. Contains problem statement, goals, discovery Q&A, user stories, ticket decomposition, and risks. |
| **Grill phase**    | The relentless clarification step before brief generation. Resolves dependencies between decisions one by one. Zero ambiguity before a single ticket is written.  |
| **Human grill**    | Interactive grill mode (default). The strategist interviews the human relentlessly.                                                                               |
| **AI-grill**       | Autonomous grill mode (triggered by `--afk` flag). A devil's advocate agent interrogates its sources.                                                             |
| **Vertical slice** | A ticket that cuts through all integration layers to deliver one thin, working piece of functionality end-to-end.                                                 |
| **HITL**           | Human-in-the-loop. A ticket tagged as requiring human judgement during implementation.                                                                            |
| **AFK**            | A ticket tagged as implementable autonomously without human intervention.                                                                                         |

## Pipeline Labels

| Term                   | Definition                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------- |
| **Pipeline label**     | A board label marking which stage a ticket is at in Clancy's pipeline.              |
| **`clancy:brief`**     | Label for tickets that have been briefed but not yet approved.                      |
| **`clancy:plan`**      | Label for tickets that need planning.                                               |
| **`clancy:build`**     | Label for tickets ready for implementation.                                         |
| **Label crash safety** | Labels are transitioned add-before-remove: new label added first, then old removed. |

## Reliability

| Term                   | Definition                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| **Verification gate**  | Agent-based Stop hook that runs lint, test, and typecheck after implementation but before delivery.       |
| **Self-healing retry** | When verification fails, Clancy feeds errors back to Claude and retries up to `CLANCY_FIX_RETRIES` times. |
| **Lock file**          | `.clancy/lock.json` — prevents double-runs and enables crash recovery.                                    |
| **Resume detection**   | On startup, if a lock file exists and the PID is dead, Clancy resumes the crashed session.                |
| **Branch guard**       | PreToolUse hook that blocks force push, direct push to protected branches, and destructive resets.        |
| **Time guard**         | Warns at 80% and 100% of `CLANCY_TIME_LIMIT`.                                                             |
| **Cost log**           | `.clancy/costs.log` — append-only file recording duration-based token estimates per ticket.               |
| **Session report**     | `.clancy/session-report.md` — generated by the AFK loop after `/clancy:run` completes.                    |

## Infrastructure

| Term               | Definition                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **Hook**           | A Node.js CommonJS script that runs on Claude Code events (SessionStart, PreToolUse, etc.). Best-effort — must never crash. |
| **Board module**   | TypeScript code handling API communication with a specific board platform.                                                  |
| **Remote**         | The git hosting platform (GitHub, GitLab, Bitbucket). Detected from the git remote URL.                                     |
| **Bundle**         | The esbuild-compiled runtime scripts copied to `.clancy/` during install. Self-contained, zero npm dependency.              |
| **Command**        | A user-facing markdown file defining a slash command.                                                                       |
| **Workflow**       | An implementation-detail markdown file referenced by commands. Not directly invocable.                                      |
| **Quiet hours**    | AFK runner pauses during `CLANCY_QUIET_START`–`CLANCY_QUIET_END`.                                                           |
| **Drift detector** | PostToolUse hook that compares `.clancy/version.json` against the installed package version.                                |
