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
- `detectBoard` (in `packages/core/src/board/detect-board.ts`) uses **single-marker detection**: `JIRA_BASE_URL`, `GITHUB_TOKEN + GITHUB_REPO` (pair required to distinguish from git-host-only use), `LINEAR_API_KEY`, `SHORTCUT_API_TOKEN`, `NOTION_DATABASE_ID` alone, `AZDO_ORG` alone. Schema validation runs after detection and enforces the full required var set (e.g. Notion also needs `NOTION_TOKEN`, AzDO also needs `AZDO_PROJECT` + `AZDO_PAT`). A marker present without its supporting vars fails preflight with a credentials error — it does **not** silently fall through to local mode
- Terminal workflow files for `/clancy:settings`, `/clancy:doctor`, `/clancy:status`, `/clancy:autopilot`, and `/clancy:review` apply a **stricter pair-required** rule for Notion and Azure DevOps: `NOTION_TOKEN` + `NOTION_DATABASE_ID`, `AZDO_ORG` + `AZDO_PROJECT`. `/clancy:init` is the exception — its initial detection step uses the core-style single-marker check to match runtime behaviour during setup. The pair-required gate in the other workflows is a UI safeguard (don't offer board actions for a half-configured `.clancy/.env`), not a runtime rule. Jira, GitHub, Linear, and Shortcut detection matches core across all workflows. Documented in `docs/guides/CONFIGURATION.md` "Local mode" section
- Non-GitHub board configs must not include `GITHUB_REPO` (use `GITHUB_TOKEN` alone as git host token)
- Setup workflows support all six board providers plus **local mode (no board)**: Jira, GitHub Issues, Linear, Shortcut, Notion, Azure DevOps
- `fetchChildrenStatus` uses dual-mode: `Epic: {key}` text convention in ticket descriptions + native API fallback (Jira JQL, GitHub body search, Linear relations)
- `fetchBlockerStatus` checks blockers before ticket pickup — Jira issueLinks, GitHub body parsing (`Blocked by #N`), Linear relations
- Board label methods: `ensureLabel` (create-if-missing), `addLabel` (add to issue, calls ensureLabel internally), `removeLabel` (best-effort removal) on the `Board` type (`core/types/board.ts`)

## Local Mode & Plan-File Approval

- **Local mode** = `.clancy/.env` has none of the board markers listed above. Preflight skips board pings; `/clancy:autopilot` and `/clancy:review` stop with a redirect to `/clancy:settings`; every other command works against plan files instead of tickets
- `/clancy:implement --from <plan.md>`: synthesises a ticket from the plan file and runs the pipeline with a no-op board (no API calls). Steps 2a (dry-run) and 2b (feasibility) are skipped — the plan has already been approved. Spec in `packages/terminal/src/roles/implementer/workflows/implement.md`
- `/clancy:implement --from <dir> --afk`: batch variant. Lists `.md` files in the directory (natural sort), skips any without a matching `.approved` marker (with a warning), implements each approved plan sequentially, stops on first failure and reports a summary. Error if `--from <directory>` is passed without `--afk`
- **`.approved` marker contract**: `/clancy:approve-plan` (in `@chief-clancy/plan`) computes the SHA-256 of `.clancy/plans/{stem}.md` and writes a sibling `.clancy/plans/{stem}.approved` file via `fs.openSync(path, 'wx')` (`O_EXCL`). Body is plain text: `sha256={hex}\napproved_at={iso-timestamp}\n`. The `.approved` file is **never** re-written — re-running approve-plan on an existing marker either stops (default) or fallthroughs to the `--push` board retry, depending on flags
- **Marker verification — currently deferred**: the verifier `checkApprovalStatus()` exists in `packages/dev/src/lifecycle/plan-file/plan-file.ts:144` and reads the marker, re-computes SHA-256 of the plan file, and compares against the marker's `sha256=` value. However, it is **not yet wired** into local-mode preflight (`packages/dev/src/entrypoints/dev.ts` `runLocalMode` calls `runPipeline` directly). Per `approve-plan.md:412-418`, this gate is **intentionally deferred** — until a dedicated verifier ships, approval is enforced manually (the user or Claude Code reads the marker and refuses to apply on mismatch) or by workflow convention. Batch mode (`--from <dir> --afk`) similarly has no marker-filtering wired despite workflow docs claiming it does (`listPlans()` has no caller). Treat the marker as a **write-side contract only** today
- **Re-approving a stale plan**: delete `.clancy/plans/{stem}.approved` and re-run `/clancy:approve-plan {stem}`. There is intentionally no `--force` flag — the delete-then-approve flow makes drift explicit (once the verifier is wired, this flow becomes user-facing; today it's prep-work)
- Board detection markers (`GITHUB_TOKEN`, `AZDO_PAT`) have **dual use**: they serve as both board credentials and git-host credentials depending on context. `/clancy:settings` → Disconnect board preserves them when `CLANCY_GIT_PLATFORM` indicates they're still needed for PR creation

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
- Per-invocation override: `--afk` flag (supported on `/clancy:brief`, `/clancy:approve-brief`, `/clancy:plan`, `/clancy:approve-plan`, `/clancy:update-terminal`, `/clancy:update-brief`, `/clancy:update-plan`, `/clancy:update-dev`)
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
