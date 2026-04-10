# Technical Reference

Implementation details, conventions, and gotchas. Read this when working on specific features — not every session needs it.

For architecture overview, see [ARCHITECTURE.md](ARCHITECTURE.md). For code conventions, see [CONVENTIONS.md](CONVENTIONS.md).

---

## Board Integration

All board modules live in `packages/core/src/board/`.

- Jira uses the new `POST /rest/api/3/search/jql` endpoint (old GET `/search` removed Aug 2025)
- Linear personal API keys do NOT use "Bearer" prefix (OAuth tokens do)
- Linear filters by `state.type: "unstarted"` (enum), not state name (team-specific)
- Linear `viewer.assignedIssues` requires `$teamId: ID!` (not `String!`) and `orderBy: createdAt` (not `priority`)
- Shortcut `/stories/search` uses `workflow_state_id` (singular, not plural) and may return a bare array instead of `{ data: [...] }`
- Shortcut `/member-info` returns 404 for some API token types — ping falls back to `/workflows`
- Notion status filter uses `status` type only (not `or(status, select)` — Notion returns 400 for mismatched filter types). `CLANCY_NOTION_TODO` overrides the default `"To-do"` status value
- `detectBoard` checks `GITHUB_TOKEN + GITHUB_REPO` before other boards — non-GitHub board configs must not include `GITHUB_REPO` (use `GITHUB_TOKEN` alone as git host token)
- Setup workflows support all board providers: Jira, GitHub Issues, Linear, Shortcut, Notion, Azure DevOps
- `fetchChildrenStatus` uses dual-mode: `Epic: {key}` text convention in ticket descriptions + native API fallback (Jira JQL, GitHub body search, Linear relations)
- `fetchBlockerStatus` checks blockers before ticket pickup — Jira issueLinks, GitHub body parsing (`Blocked by #N`), Linear relations
- Board label methods: `ensureLabel` (create-if-missing), `addLabel` (add to issue, calls ensureLabel internally), `removeLabel` (best-effort removal) on the `Board` type (`core/types/board.ts`)

## Hooks

All hook source lives in `packages/terminal/src/hooks/`, built to CJS bundles by `esbuild.hooks.ts`.

- Hook files must run as CommonJS — the installer writes `{"type":"commonjs"}` package.json into the hooks directory
- Hooks are best-effort — they must never crash or block the user's workflow
- Verification gate: agent-based prompt runs lint/test/typecheck before delivery, self-healing retry up to `CLANCY_FIX_RETRIES` (default 2)
- Branch guard: PreToolUse hook blocks force push, protected branch push, destructive resets. Configurable via `CLANCY_BRANCH_GUARD`
- Time guard: PostToolUse warnings at 80%/100% of `CLANCY_TIME_LIMIT` (default 30 min), integrated into context-monitor hook
- PostCompact hook: re-injects ticket context (key, description, branch) after Claude Code compacts the context window
- Desktop notifications: `CLANCY_DESKTOP_NOTIFY` enables/disables native OS desktop notifications via the notification hook (macOS osascript, Linux notify-send, Windows PowerShell)
- Drift detector: PostToolUse hook compares `.clancy/version.json` against installed package VERSION file. Warns once per session when versions differ
- Version tracking: installer writes `.clancy/version.json` on install/update containing `{ version, installedAt }`

## Build & Runtime

- Monorepo uses pnpm workspaces + Turbo for parallel builds
- TypeScript modules use `zod/mini` for all runtime validation of external data (not full `zod`)
- Path aliases: `~/c/` resolves to `core/src/*`, `~/t/` resolves to `terminal/src/*` — rewritten by `tsc-alias` at build time
- Runtime scripts (`clancy-implement.js`, `clancy-autopilot.js`) are esbuild bundles — self-contained, zero runtime dependency on the npm package
- `dist/bundle/` in the terminal package contains the bundled scripts; the installer copies them to `.clancy/` during install
- Hook bundles are built by `esbuild.hooks.ts` — self-contained CJS, each with its own entry point
- `chief-clancy` package is a thin CLI wrapper — `bin/clancy.js` resolves the terminal package on disk and delegates to `runInstall`

## Delivery & Git

Delivery modules live in `packages/dev/src/lifecycle/`. PR creation lives in `dev/src/lifecycle/pull-request/`.

- PR-based flow: all tickets create PRs — parented tickets target the epic branch (`epic/{key}` or `milestone/{slug}`), standalone tickets target the base branch. When all children are done, Clancy auto-creates the epic PR to the base branch
- Epic context in child PRs: when a child PR targets an epic branch, the PR body includes a banner with the parent epic key, sibling delivery count (derived from `DELIVERED_STATUSES`), and a note about the intermediate branch
- GitHub epic completion: after creating the epic PR, Clancy adds the build label (`CLANCY_LABEL_BUILD` or `CLANCY_LABEL` fallback) to the parent GitHub issue so downstream tooling can discover it. Best-effort via `board.addLabel` (errors swallowed). Non-GitHub boards use `transitionTicket` instead
- Single-child parent auto-close: when single-child skip is active, the child PR body includes `Closes #{parent}` (GitHub only, valid issue refs only) so the parent auto-closes on merge
- PR retry phase: retries PR creation for tickets that were pushed but failed to create a PR (network recovery). Scans progress.txt for PUSHED entries without PR_CREATED
- Remote detection: `parseRemote()` in `core/shared/remote/` handles GitHub, GitLab, Bitbucket Cloud/Server, Azure DevOps, GHE, and self-hosted instances
- Git host auth: GitHub uses Bearer token, GitLab uses PRIVATE-TOKEN header, Bitbucket uses Basic Auth
- `CLANCY_GIT_PLATFORM` and `CLANCY_GIT_API_URL` override auto-detection for custom domains
- `CLANCY_STATUS_REVIEW` is used when creating a PR (falls back to `CLANCY_STATUS_DONE`)
- GitHub Issues reuse `GITHUB_TOKEN` for PR creation; Jira/Linear users configure a separate git host token
- Lock file (`.clancy/lock.json`): prevents double-runs, enables crash recovery via PID check + resume detection (`dev/src/lifecycle/lock/`)
- Cost logging: duration-based token estimate per ticket appended to `.clancy/costs.log` using `CLANCY_TOKEN_RATE` (default 6600 tokens/min) (`dev/src/lifecycle/cost/`)
- Session report: `.clancy/session-report.md` generated after `/clancy:autopilot` summarises completed/failed tickets (`terminal/runner/session-report/`)

## Pipeline Labels

- 3 labels (`CLANCY_LABEL_BRIEF`, `CLANCY_LABEL_PLAN`, `CLANCY_LABEL_BUILD`) control ticket flow through stages
- `CLANCY_LABEL` and `CLANCY_PLAN_LABEL` are deprecated but work as fallbacks
- Transitions use add-before-remove for crash safety
- `--skip-plan` flag on `/clancy:approve-brief` applies `CLANCY_LABEL_BUILD` directly, skipping the planning queue

## AFK / Autonomous Mode

Runner modules live in `packages/terminal/src/runner/`.

- `CLANCY_MODE` env var (`interactive` | `afk`) controls grill mode and confirmation prompts — human grill + prompts in interactive, AI-grill + auto-confirm in AFK
- Per-invocation override: `--afk` flag (supported on `/clancy:brief`, `/clancy:approve-brief`, `/clancy:plan`, `/clancy:approve-plan`, `/clancy:update`)
- HITL/AFK queue filtering: tickets labelled `clancy:hitl` are skipped in AFK mode, ensuring human-in-the-loop tickets only run interactively
- AFK auto-pull: all workflows with branch freshness checks auto-pull in AFK mode instead of prompting
- Quiet hours: `CLANCY_QUIET_START` and `CLANCY_QUIET_END` (HH:MM 24h format) pause AFK runs during the configured window. Handles overnight windows

## Strategist

- `Epic: {key}` description convention: child tickets include this text for cross-platform epic completion detection
- `CLANCY_BRIEF_ISSUE_TYPE`, `CLANCY_BRIEF_EPIC`, `CLANCY_COMPONENT` env vars configure strategist ticket creation

## Progress Status Constants

Defined in `packages/core/src/types/`:

- `DELIVERED_STATUSES`: PR_CREATED, PUSHED, REWORK, RESUMED
- `COMPLETED_STATUSES`: DONE, PR_CREATED, PUSHED, EPIC_PR_CREATED, RESUMED
- `FAILED_STATUSES`: SKIPPED, PUSH_FAILED, TIME_LIMIT

Used by resume, deliver, and session report modules.

## Publishing

- Changesets manage versioning — `pnpm changeset` creates a changeset file, `changeset version` bumps versions
- `@changesets/changelog-github` generates changelog entries with PR links and author attribution
- `scripts/group-changelog.ts` post-processes changelogs to group entries under gitmoji category headers
- Publish workflow (`.github/workflows/publish.yml`) triggers after CI success via `workflow_run`, creates version PRs, and publishes to npm
- `NPM_TOKEN` secret required in repo settings for npm publish auth
