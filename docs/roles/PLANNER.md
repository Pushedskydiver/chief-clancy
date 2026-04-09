# Planner Role _(virtual)_

The planner refines backlog tickets and local Clancy briefs into structured implementation plans **before** they reach the implementer. It uses a separate planning queue so it never competes with the implementer for tickets.

## Where the planner lives

The planner is a **virtual role** — there is no `packages/terminal/src/roles/planner/` directory on disk. The planner's slash commands (`/clancy:plan`, `/clancy:approve-plan`, `/clancy:board-setup`) all live in [`@chief-clancy/plan`](../../packages/plan/), the standalone implementation planner package.

The role-key concept lives on in two places in terminal:

- [`packages/terminal/src/installer/ui/ui.ts`](../../packages/terminal/src/installer/ui/ui.ts) `COMMAND_GROUPS` includes a Planner entry with `roleKey: 'planner'` so the UI can show / hide the planner command surface during install
- [`packages/terminal/src/installer/plan-content/plan-content.ts`](../../packages/terminal/src/installer/plan-content/plan-content.ts) gates `enabledRoles.has('planner')` so the terminal installer knows whether to copy plan files from `@chief-clancy/plan` into a terminal-mode install

This is the same shape as the strategist role — see [STRATEGIST.md](./STRATEGIST.md). Both are virtual roles whose files live in standalone packages.

## Enable the planner (terminal mode)

In terminal mode the planner is an opt-in role. To enable it, add `planner` to `CLANCY_ROLES` in `.clancy/.env` and re-run the installer:

```bash
echo 'CLANCY_ROLES="planner"' >> .clancy/.env
npx chief-clancy@latest --local   # or --global
```

You can also toggle it via `/clancy:settings`.

## Three install modes

`/clancy:plan` and `/clancy:approve-plan` work in three install contexts:

| Mode                 | How you got here                                      | What works                                                                                                              |
| -------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Standalone**       | `npx @chief-clancy/plan --local` (or `--global`)      | `/clancy:plan --from <brief>` and `/clancy:approve-plan` write local plans + `.approved` markers                        |
| **Standalone+board** | plan installed standalone + `/clancy:board-setup` ran | Local plan-from-brief flow PLUS board ticket transport. `/clancy:approve-plan` can optionally push to the source ticket |
| **Terminal**         | `npx chief-clancy` with `planner` in `CLANCY_ROLES`   | Full pipeline behaviour with the planner role check                                                                     |

`/clancy:plan` Step 1 and `/clancy:approve-plan` Step 1 detect which mode is in effect using the same `.clancy/.env` and `.clancy/clancy-implement.js` probes. Standalone mode supports the local plan-from-brief loop independently of any board.

## How it works

1. Fetches input — a board ticket from the **planning queue** (earlier-stage tickets than the implementation queue), a specific ticket key, or a local brief file via `--from`
2. Checks branch freshness — warns if the local branch is behind the remote
3. Reads codebase docs in `.clancy/docs/` for context, explores relevant source code
4. Generates a structured implementation plan (affected files, approach, acceptance criteria, risks)
5. Posts the plan as a comment on the ticket (board mode) OR writes the plan to `.clancy/plans/{stem}.md` (local mode) with a `## Clancy Implementation Plan` marker
6. You review, leave feedback as comments (board) or by editing the local plan file with a `## Feedback` section, then either re-plan or approve

## Commands

| Command                                         | What it does                                                                                                               |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `/clancy:plan`                                  | Plan the next backlog ticket (board mode)                                                                                  |
| `/clancy:plan PROJ-123`                         | Plan a specific ticket by key (`PROJ-123`, `#42`, `ENG-42`)                                                                |
| `/clancy:plan 3`                                | Plan up to 3 tickets in batch mode (max 10)                                                                                |
| `/clancy:plan --from .clancy/briefs/<brief>.md` | Plan from a local Clancy brief file. Optional row number selects a row (`--from <brief.md> 3`). No board needed.           |
| `/clancy:plan --fresh`                          | Discard any existing plan and start from scratch                                                                           |
| `/clancy:plan --afk`                            | Skip confirmations, auto-skip done/closed tickets (for automation). With `--from`, plans every unplanned row in the brief. |
| `/clancy:plan --list`                           | Show inventory of existing local plans in `.clancy/plans/` (Planned / Approved / Stale states) and stop                    |
| `/clancy:approve-plan`                          | Promote the oldest unapproved plan to the ticket description (board) OR auto-select the oldest unapproved local plan       |
| `/clancy:approve-plan PROJ-123`                 | Approve a specific ticket's plan (board mode)                                                                              |
| `/clancy:approve-plan <stem>`                   | Approve a specific local plan by stem (e.g. `add-dark-mode-2`) — writes a `.approved` SHA-256 marker file                  |
| `/clancy:approve-plan <stem> --push`            | In standalone+board mode, push the approved plan to the source board ticket as a comment after writing the local marker    |
| `/clancy:approve-plan <stem> --ticket KEY`      | Override the auto-detected source ticket key from the plan file's `**Source:**` header                                     |
| `/clancy:approve-plan --afk`                    | Auto-confirm plan promotion / push without prompting (for automation)                                                      |
| `/clancy:board-setup`                           | Configure board credentials in standalone+board mode                                                                       |

Arguments can appear in any order (e.g. `/clancy:plan 3 --fresh` or `/clancy:plan --fresh PROJ-123`).

## Pipeline labels

The planner works with two pipeline labels:

- **`clancy:plan`** (`CLANCY_LABEL_PLAN`) — `/clancy:plan` filters by this label to find tickets needing planning
- **`clancy:build`** (`CLANCY_LABEL_BUILD`) — `/clancy:approve-plan` adds this label (then removes `clancy:plan`) to mark tickets ready for implementation

The new label is always added before the old one is removed (crash safety). Falls back to `CLANCY_PLAN_LABEL` if `CLANCY_LABEL_PLAN` is not set.

The label decisions in `/clancy:approve-brief` (which creates child tickets) follow the same single-source-of-truth rule documented at the top of [`approve-brief.md` Step 6](../../packages/brief/src/workflows/approve-brief.md) — see [STRATEGIST.md](./STRATEGIST.md#pipeline-label-selection-rule) for the four-rule precedence.

## Local plan-from-brief flow

The `--from` flag lets the planner work entirely offline against a Clancy brief file — no board required:

```bash
# 1. Generate a brief (uses @chief-clancy/brief)
/clancy:brief "Add dark mode support"
# Saved to .clancy/briefs/2026-04-08-add-dark-mode.md

# 2. Plan the first decomposition row
/clancy:plan --from .clancy/briefs/2026-04-08-add-dark-mode.md
# Saved to .clancy/plans/add-dark-mode-1.md

# 3. Plan a specific row
/clancy:plan --from .clancy/briefs/2026-04-08-add-dark-mode.md 3
# Saved to .clancy/plans/add-dark-mode-3.md

# 4. Or plan every unplanned row in one pass
/clancy:plan --afk --from .clancy/briefs/2026-04-08-add-dark-mode.md

# 5. Review what's been planned
/clancy:plan --list

# 6. Revise — edit the plan file and add a `## Feedback` section
/clancy:plan --from .clancy/briefs/2026-04-08-add-dark-mode.md 3
# Detects feedback, regenerates with a `### Changes From Previous Plan` section

# 7. Approve — writes a SHA-256 marker that any plan-implementing tool can verify
/clancy:approve-plan add-dark-mode-3
```

Plans are tracked in the brief file itself via a `<!-- planned:1,2,3 -->` marker, so re-running advances to the next unplanned row automatically. After approval the brief marker becomes `<!-- approved:1 planned:1,2,3 -->` so `/clancy:plan --list` knows which rows are approved.

## Approving plans (three install modes)

### Standalone (no board)

`/clancy:approve-plan <stem>` writes a `.clancy/plans/{stem}.approved` marker file containing the full lowercase hex SHA-256 of the plan file and an ISO 8601 UTC approval timestamp. Any plan-implementing tool reads the marker, hashes the current plan file, and blocks implementation on a SHA mismatch — if the plan file is edited after approval, you must re-approve before applying it.

Applying an approved plan (reading the marker, verifying the SHA, then writing the actual code changes) is downstream consumption of the plan package's output rather than part of the planner's lifecycle, so it lives outside `@chief-clancy/plan`. To apply a standalone-approved plan you can ask Claude Code directly (e.g. `Implement .clancy/plans/add-dark-mode-2.md, verifying the .approved marker's sha256 first`) or install the full pipeline (`npx chief-clancy`) and use the board-driven flow.

### Standalone+board (board credentials but no full pipeline)

The argument decides which path runs:

- **Plan-file stem** (e.g. `add-dark-mode-2`): writes the local marker, then optionally pushes the approved plan to the source board ticket as a comment. The push is interactive by default — `/clancy:approve-plan add-dark-mode-2` prompts `Push approved plan to {KEY} as a comment? [y/N]` (default No, never surprise-write to a board). Use `--push` to skip the prompt and push immediately, `--ticket KEY` to override the auto-detected key from the plan file's `**Source:**` header, and `--afk` to combine with `--push` for unattended automation. If the push fails (HTTP error, network issue, key/board mismatch), the local marker stays in place and an exact retry command is printed.
- **Board ticket key** (e.g. `PROJ-123`): runs the full board comment-to-description transport flow — fetches the plan comment, appends it to the ticket description, edits the plan comment with an approval note, swaps the ticket labels (`CLANCY_LABEL_PLAN` → `CLANCY_LABEL_BUILD`), and (if `CLANCY_STATUS_PLANNED` is configured) transitions the ticket status.

The plan-file lookup runs first, so plan stems win on collision (`PROJ-123.md` exists locally AND `PROJ-123` is a valid ticket key → the local plan wins).

### Terminal mode (full pipeline)

Existing behaviour, unchanged. Board ticket transport, queue transitions, and the implementation handoff all work as they did before.

## Planning queue filters

The planner fetches from a **separate queue** to the implementer, targeting earlier-stage tickets:

| Board        | Default filter                   | Env var to customise     |
| ------------ | -------------------------------- | ------------------------ |
| Jira         | `status = "Backlog"`             | `CLANCY_PLAN_STATUS`     |
| GitHub       | Label: `needs-refinement`        | `CLANCY_PLAN_LABEL`      |
| Linear       | `state.type: "backlog"`          | `CLANCY_PLAN_STATE_TYPE` |
| Shortcut     | Workflow state type: `"backlog"` | `CLANCY_PLAN_STATE_TYPE` |
| Notion       | Status property filter           | `CLANCY_PLAN_STATUS`     |
| Azure DevOps | Work item state filter           | `CLANCY_PLAN_STATUS`     |

`CLANCY_PLAN_STATE_TYPE` accepts one of: `backlog`, `unstarted`, `started`, `completed`, `canceled`, `triage`.

Additional filters vary by board:

- **Jira:** `CLANCY_LABEL_PLAN` and `CLANCY_JQL_SPRINT` apply on top of the planning queue filter (status-based filtering is primary; label is supplementary when set)
- **GitHub:** Uses `CLANCY_LABEL_PLAN` (falls back to `CLANCY_PLAN_LABEL`) only
- **Linear:** No additional label filter
- **All boards:** `assignee = currentUser()` always applies

### How transitions work per board

**Jira:** Transitions use native status columns. `/clancy:approve-plan` transitions the ticket to the status specified by `CLANCY_STATUS_PLANNED` (if configured). If `CLANCY_STATUS_PLANNED` is not set, the transition is skipped and you move the ticket manually.

**Linear:** `/clancy:approve-plan` automatically moves the ticket to the "unstarted" state (the implementation queue). The unstarted state UUID is resolved via a `workflowStates` query. Best-effort — warns on failure, never blocks.

**GitHub:** Issues don't have status columns — they're either `open` or `closed`. Clancy uses **labels as queues** instead:

1. **You** add the `needs-refinement` label to issues you want planned (this is a manual step)
2. `/clancy:plan` picks up issues with that label
3. `/clancy:approve-plan` adds `CLANCY_LABEL_BUILD` (falls back to `CLANCY_LABEL`), then removes `CLANCY_LABEL_PLAN` (falls back to `CLANCY_PLAN_LABEL`). Crash-safe: add before remove.
4. `/clancy:implement` picks up issues filtered by `CLANCY_LABEL_BUILD` (falls back to `CLANCY_LABEL`, otherwise all open assigned issues)
5. On completion, Clancy closes the issue

No GitHub Projects integration — Clancy works with the Issues REST API only.

**Shortcut:** `/clancy:approve-plan` adds the build label, removes the plan label, and transitions the story to the "unstarted" workflow state via `workflow_state_id`. Best-effort — warns on failure.

**Notion:** `/clancy:approve-plan` adds the build label to the page's multi-select property, removes the plan label, and transitions the status property (only if `CLANCY_STATUS_PLANNED` is set). The plan is appended to the page content rather than the description field.

**Azure DevOps:** `/clancy:approve-plan` adds the build tag (semicolon-delimited), removes the plan tag, and transitions the work item state (only if `CLANCY_STATUS_PLANNED` is set). If not set, prompts the user to move the work item manually.

## The board workflow

```
/clancy:plan          Post plan as comment on ticket
      ↓
Review + feedback     Team comments on the ticket normally
      ↓
/clancy:plan          Re-plan — auto-detects feedback and revises
      ↓
/clancy:approve-plan  Promote plan to description, transition to implementation queue
      ↓
/clancy:implement     Implementer picks it up with full plan context
```

### Plan

When `/clancy:plan` runs in board mode, it:

1. **Preflight** — detects install mode, checks `.clancy/.env`, board credentials, codebase docs (terminal-mode preflight also checks the planner role gate)
2. **Branch freshness** — fetches from remote, warns if local branch is behind `origin/main` (or `CLANCY_BASE_BRANCH`), offers pull/continue/abort
3. **Fetch** — pulls tickets from the planning queue (or fetches a specific ticket if a key was provided)
4. **Existing plan check** — auto-detects whether the ticket already has a plan:
   - **Has plan + feedback comments:** revises the plan incorporating feedback
   - **Has plan + no feedback:** tells you to add feedback first
   - **`--fresh` flag:** discards the existing plan and starts from scratch
5. **Skip check** — irrelevant or infeasible tickets are skipped. If `CLANCY_SKIP_COMMENTS` is enabled (default: `true`), a comment is posted on the ticket explaining why it was skipped.
6. **QA return check** — looks in `.clancy/progress.txt` for previously implemented tickets that have returned
7. **Explore** — reads codebase docs, examines relevant source files, checks Figma if configured
8. **Generate plan** — writes a structured implementation plan
9. **Post** — adds the plan as a comment on the ticket
10. **Log** — appends to `.clancy/progress.txt`

### Re-plan (auto-detect)

Running `/clancy:plan` on an already-planned ticket automatically detects feedback. Clancy reads all comments posted **after** the most recent `## Clancy Implementation Plan` comment. These are treated as feedback — no special syntax needed, just comment normally on the ticket.

If feedback exists, Clancy revises the plan incorporating the new comments. If no feedback exists, it tells you to add some first.

To discard an existing plan entirely and start from scratch, use `/clancy:plan --fresh`.

### Approve (board mode)

When `/clancy:approve-plan PROJ-123` runs against a board ticket key, it:

1. **Auto-selects** — if no key is provided, scans `.clancy/progress.txt` for the oldest planned-but-unapproved ticket and shows a confirmation prompt
2. Fetches the ticket and its comments
3. Finds the most recent `## Clancy Implementation Plan` comment
4. Appends the plan to the ticket description (never replaces the original description)
5. **Edits the plan comment** — prepends an approval note to the existing comment (does not delete it)
6. **Transitions the ticket** to the implementation queue (per the per-board rules above). Best-effort — warns on failure, never blocks.
7. Logs the approval to `.clancy/progress.txt`

## Plan template

The generated plan includes (in this order):

- **Summary** — one-line overview
- **Affected Files** — which files will be created, modified, or deleted
- **Implementation Approach** — step-by-step implementation strategy
- **Test Strategy** — how the changes should be tested
- **Acceptance Criteria** — testable criteria derived from the ticket
- **Dependencies** — external dependencies or prerequisites
- **Figma Link** — design reference (when a Figma URL is present in the ticket)
- **Risks / Considerations** — potential issues to watch for
- **Size Estimate** — S / M / L
- **Footer** — links back to Clancy with instructions for re-planning and approving
