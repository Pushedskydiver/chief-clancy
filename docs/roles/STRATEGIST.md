# Strategist Role _(virtual)_

The strategist decomposes vague ideas into actionable, well-structured tickets **before** they reach the planner or implementer. It uses a grill phase to eliminate ambiguity, then generates a brief with a ticket decomposition table.

## Where the strategist lives

The strategist is a **virtual role** — there is no `packages/terminal/src/roles/strategist/` directory on disk. The strategist's slash commands (`/clancy:brief`, `/clancy:approve-brief`, `/clancy:board-setup`) and supporting agent (`devils-advocate.md`) all live in [`@chief-clancy/brief`](../../packages/brief/), the standalone brief generator package.

The role-key concept lives on in two places in terminal:

- [`packages/terminal/src/installer/ui.ts`](../../packages/terminal/src/installer/ui.ts) `COMMAND_GROUPS` includes a Strategist entry with `roleKey: 'strategist'` so the UI can show / hide the strategist command surface during install
- [`packages/terminal/src/installer/brief-content.ts`](../../packages/terminal/src/installer/brief-content.ts) gates `enabledRoles.has('strategist')` so the terminal installer knows whether to copy brief files from `@chief-clancy/brief` into a terminal-mode install

This is the same shape as the planner role — see [PLANNER.md](./PLANNER.md). Both are virtual roles whose files live in standalone packages.

## Enable the strategist (terminal mode)

In terminal mode the strategist is an opt-in role. To enable it, add `strategist` to `CLANCY_ROLES` in `.clancy/.env` and re-run the installer:

```bash
echo 'CLANCY_ROLES="strategist"' >> .clancy/.env
npx chief-clancy@latest --local   # or --global
```

You can also toggle it via `/clancy:settings`.

## Three install modes

`/clancy:brief` and `/clancy:approve-brief` work in three install contexts (the same three contexts the plan package supports):

| Mode                 | How you got here                                       | What works                                                                             |
| -------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| **Standalone**       | `npx @chief-clancy/brief --local` (or `--global`)      | `/clancy:brief` only — no board, no `/clancy:approve-brief` (nothing to approve to)    |
| **Standalone+board** | brief installed standalone + `/clancy:board-setup` ran | `/clancy:brief` from inputs and tickets, `/clancy:approve-brief` creates child tickets |
| **Terminal**         | `npx chief-clancy` with `strategist` in `CLANCY_ROLES` | Full pipeline behaviour, including the strategist role check                           |

`/clancy:approve-brief` Step 1 detects which mode is in effect using the same `.clancy/.env` and `.clancy/clancy-implement.js` probes as `/clancy:plan` and `/clancy:approve-plan`. In standalone mode it hard-stops with a `/clancy:board-setup` message because there is nothing for it to do without a board.

## How it works

1. Takes input — a board ticket, inline text, or file path describing a vague idea
2. Runs a grill phase (human-interactive or AI-autonomous) to resolve ambiguity
3. Researches the codebase and external context via specialist agents
4. Generates a structured brief with problem statement, discovery Q&A, ticket decomposition
5. Saves the brief to `.clancy/briefs/` and (if board-sourced) posts as a comment
6. On approval, creates tickets on the board with dependencies, labels, and epic references

## Commands

| Command                           | What it does                                                      |
| --------------------------------- | ----------------------------------------------------------------- |
| `/clancy:brief`                   | Grill and generate a brief from a vague idea                      |
| `/clancy:brief PROJ-123`          | Brief a specific board ticket                                     |
| `/clancy:brief 3`                 | Brief up to 3 tickets in batch mode (max 10, implies AI-grill)    |
| `/clancy:brief --afk`             | Force AI-grill mode for this invocation                           |
| `/clancy:brief --fresh`           | Discard any existing brief and start from scratch                 |
| `/clancy:brief --from <path>`     | Brief from a local file (text, RFC, etc) without touching a board |
| `/clancy:brief --list`            | Show inventory of existing briefs in `.clancy/briefs/`            |
| `/clancy:approve-brief`           | Create tickets on the board from the most recent unapproved brief |
| `/clancy:approve-brief <slug>`    | Approve a specific brief (slug = filename without extension)      |
| `/clancy:approve-brief --afk`     | Auto-confirm ticket creation without prompting (for automation)   |
| `/clancy:approve-brief --dry-run` | Preview what would be created without making API calls            |
| `/clancy:board-setup`             | Configure board credentials in standalone+board mode              |

Arguments can appear in any order (e.g. `/clancy:brief 3 --afk` or `/clancy:brief --fresh PROJ-123`).

## Grill phase

The grill phase is the relentless clarification step before brief generation. It walks every branch of the design tree, resolving dependencies between decisions one by one. The goal is zero ambiguity before a single ticket is written.

### Human grill (default)

Interactive mode. The strategist researches the codebase and board context first, then interviews the human — for each question, it provides a recommended answer based on its research. The user confirms, overrides, or asks for more detail. This speeds up the grill: confirm-or-override rather than research-from-scratch. Pushes back on vague answers, follows each thread to its conclusion. Two-way: the user can ask questions back and the strategist researches and answers. Typically 2-5 rounds.

The brief is NOT generated until shared understanding is reached.

### AI-grill (`--afk` or `CLANCY_MODE=afk`)

Autonomous mode. A devil's advocate agent (prompt: [`packages/brief/src/agents/devils-advocate.md`](../../packages/brief/src/agents/devils-advocate.md)) interrogates its sources — codebase, board context, and web — to answer clarifying questions. Same relentless energy as the human grill: challenges its own answers, flags conflicts between sources, and follows self-generated follow-ups to their conclusion. Never asks the human. Single pass.

AI-grill is implied when running in batch mode (`/clancy:brief 3`).

## Brief template

The generated brief includes (in this order):

- **Problem Statement** — what problem this solves and why it matters
- **Goals / Non-Goals** — explicit scope boundaries
- **Discovery** — Q&A from the grill phase, each answer tagged with source: `(Source: human)`, `(Source: codebase)`, `(Source: board)`, `(Source: web)`
- **User Stories** — who benefits and how
- **Ticket Decomposition** — table of proposed child tickets with title, description, size (S/M/L), dependencies, and mode (`AFK` or `HITL`). Max 10 tickets, vertical slices preferred
- **Open Questions** — unresolved items for the PO to address during review
- **Success Criteria** — measurable outcomes
- **Risks** — potential issues, technical debt, or unknowns

## Pipeline label selection rule

Every child ticket created by `/clancy:approve-brief` gets exactly one pipeline label that determines which queue picks the ticket up downstream (`/clancy:plan` for the planning queue, `/clancy:implement` for the build queue). The rule is documented as a single source of truth at the top of [`approve-brief.md` Step 6](../../packages/brief/src/workflows/approve-brief.md), in precedence order:

1. `--skip-plan` flag is set → `CLANCY_LABEL_BUILD` (default `clancy:build`). The user has explicitly opted out of the planning queue for this run.
2. Install mode is **standalone+board** → `CLANCY_LABEL_PLAN` (default `clancy:plan`). Standalone+board users have installed both `@chief-clancy/brief` and `@chief-clancy/plan` as standalone packages and clearly intend to use plan, even though they have no `CLANCY_ROLES` configured.
3. Install mode is **terminal** AND `CLANCY_ROLES` includes `planner` (or `CLANCY_ROLES` is unset) → `CLANCY_LABEL_PLAN`.
4. Install mode is **terminal** AND `CLANCY_ROLES` is set but does NOT include `planner` → `CLANCY_LABEL_BUILD`. The terminal user has explicitly opted out of the planning queue by not enabling the planner role.

The brief label (`CLANCY_LABEL_BRIEF`, default `clancy:brief`) is removed from the parent ticket as part of `/clancy:approve-brief`. When re-briefing with `/clancy:brief --fresh`, any existing pipeline labels (`clancy:plan`, `clancy:build`) are removed from the source ticket first.

## Approve flow

When `/clancy:approve-brief` runs, it:

1. **Step 1 preflight** — detects install mode (standalone hard-stops; terminal-mode runs the strategist `CLANCY_ROLES` check; standalone+board sources `.clancy/.env` for credentials)
2. **Auto-selects** — if no slug is provided, picks the oldest unapproved brief from `.clancy/briefs/` and shows a confirmation prompt
3. Parses the ticket decomposition table from the brief
4. **Topological sort** — orders tickets by dependency (blockers created first)
5. **Confirmation** — displays the HITL/AFK breakdown and asks for approval
6. **Creates tickets** on the board sequentially (500ms delay between creates):
   - Each ticket description includes `Epic: {key}` for cross-platform epic completion detection
   - Labels: `clancy:afk` for autonomous tickets, `clancy:hitl` for human-in-the-loop tickets
   - Pipeline label per the selection rule above
   - Issue type configurable via `CLANCY_BRIEF_ISSUE_TYPE`
   - Parent epic configurable via `CLANCY_BRIEF_EPIC`
7. **Removes brief label** from the parent ticket
8. **Links dependencies** — creates blocking relationships between tickets on the board
9. **Marks brief as approved** — writes `.approved` marker file
10. Displays a summary with next steps

Partial failures stop immediately — re-running resumes from the last unapproved row, never duplicating tickets.

## Configuration

| Variable                  | Default        | Purpose                                                                                                                                |
| ------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `CLANCY_MODE`             | `interactive`  | Grill mode: `interactive` (human) or `afk` (AI-grill). Override per-invocation with `--afk`                                            |
| `CLANCY_BRIEF_ISSUE_TYPE` | Board default  | Issue type for created tickets (e.g. `Story`, `Task`)                                                                                  |
| `CLANCY_BRIEF_EPIC`       | —              | Parent epic key for created tickets (e.g. `PROJ-100`, `#50`)                                                                           |
| `CLANCY_COMPONENT`        | —              | Component/platform filter — limits research and ticket scope to a specific area                                                        |
| `CLANCY_LABEL_BRIEF`      | `clancy:brief` | Label `/clancy:brief` applies to the source ticket after posting the brief                                                             |
| `CLANCY_LABEL_PLAN`       | `clancy:plan`  | Pipeline label for child tickets in the planning queue (per the selection rule above)                                                  |
| `CLANCY_LABEL_BUILD`      | `clancy:build` | Pipeline label for child tickets in the build queue (per the selection rule above)                                                     |
| `CLANCY_ROLES`            | —              | In terminal mode, must include `strategist` to enable this role. Standalone+board users have no `CLANCY_ROLES` and the gate is skipped |

## Integration with other roles

The strategist sits at the start of the pipeline:

```
/clancy:brief          Grill + generate brief
      |
Human reviews brief    PO reviews on board or in .clancy/briefs/
      |
/clancy:approve-brief  Create tickets on board (with dependencies + labels)
      |
/clancy:plan           Planner refines tickets (optional)
      |
/clancy:implement      Implementer picks up tickets
```

Tickets created by `/clancy:approve-brief` are immediately available to the planner or implementer depending on the pipeline label they receive. AFK-labelled tickets are picked up by `/clancy:autopilot`; HITL-labelled tickets are skipped in AFK mode and require interactive `/clancy:implement`.

## Stale brief detection

Briefs that remain unapproved for more than 7 days are flagged as stale. The stale brief hook checks on SessionStart and warns the user, prompting them to either approve or discard the brief.
