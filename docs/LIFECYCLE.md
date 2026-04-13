# Lifecycle — End-to-End Flow

The complete journey of a feature from idea to merged code. Human steps are marked with 👤.

Clancy runs either of two parallel paths:

- **Board path** — tickets flow through the `clancy:brief → clancy:plan → clancy:build` label pipeline on your Kanban board.
- **Local path** — no board. Briefs, plans, and approvals live as files in `.clancy/briefs/` and `.clancy/plans/`. The gate for implementation is a sibling `.approved` marker file (written by `/clancy:approve-plan`, containing the plan's SHA-256 and an approval timestamp).

Commands have the same names in both paths; `--from <file>` flags route to the local variant.

The local path uses `/clancy:brief` (Strategist role) and `/clancy:plan` (Planner role). Both are **optional roles** — enable them during `/clancy:init` or via `/clancy:settings`. Without them, those commands are not installed.

---

## Strategy Phase

Owned by the **Strategist** virtual role (see [docs/roles/STRATEGIST.md](roles/STRATEGIST.md)). Slash commands ship in [`@chief-clancy/brief`](../packages/brief/) and can be installed standalone via `npx @chief-clancy/brief`.

**Board path:**

```
👤 Create a vague ticket on your board
   (e.g. "Add customer portal" on Jira/GitHub/Linear)

👤 Run /clancy:brief PROJ-200
   │
   ├─ Clancy researches the codebase (1-4 agents)
   ├─ Grill phase:
   │    Interactive → 👤 Clancy grills you, you answer
   │    AFK (--afk) → Clancy grills itself (AI-grill)
   ├─ Generates brief with:
   │    Discovery, User Stories, Vertical Slices,
   │    Ticket Decomposition, HITL/AFK tags
   ├─ Adds clancy:brief label to ticket
   └─ Saves to .clancy/briefs/ + posts on board

👤 Review the brief
   │
   ├─ Happy? → continue
   ├─ Want changes? → 👤 Comment on ticket or add
   │    ## Feedback to the brief file, then:
   │    👤 Run /clancy:brief PROJ-200 (auto-revises)
   │    👤 Review again (loop until satisfied)
   └─ Start over? → 👤 /clancy:brief --fresh PROJ-200

👤 Run /clancy:approve-brief PROJ-200
   │
   ├─ Clancy shows ticket list + deps + HITL/AFK breakdown
   ├─ 👤 Confirm [Y/n] (skipped with --afk)
   ├─ Removes clancy:brief from parent ticket
   ├─ Creates child tickets on board (with Epic: convention)
   │    Each child gets clancy:plan label (or clancy:build with --skip-plan)
   ├─ Links dependencies (blocking relationships)
   └─ Posts summary on parent ticket

   Board now has: PROJ-201, PROJ-202, PROJ-203, etc.
   Each tagged AFK or HITL, with dependencies linked.
   Each labelled clancy:plan (ready for /clancy:plan).
```

**Local path:**

```
👤 Draft a rough outline in a local file
   (e.g. outline.md — a few lines on what you want built)

👤 Run /clancy:brief --from outline.md
   │
   ├─ Same grill + research flow as the board path
   └─ Writes brief to .clancy/briefs/<slug>.md
      (no board ticket is created)

👤 Review .clancy/briefs/<slug>.md
   │
   ├─ Want changes? → 👤 add ## Feedback, re-run /clancy:brief --from
   └─ Happy? → continue to planning (no approve-brief step in local path;
      the local flow skips ticket creation, so approval is implicit)
```

---

## Planning Phase (optional)

Owned by the **Planner** virtual role (see [docs/roles/PLANNER.md](roles/PLANNER.md)). Slash commands ship in [`@chief-clancy/plan`](../packages/plan/) and can be installed standalone via `npx @chief-clancy/plan`. Skip if tickets are clear enough from the brief.

**Board path:**

```
👤 Run /clancy:plan (picks next ticket with clancy:plan label)
   │
   ├─ Clancy reads the ticket + codebase
   ├─ Generates implementation plan
   └─ Posts plan as comment on ticket

👤 Review the plan
   │
   ├─ Happy? → 👤 /clancy:approve-plan
   │    (removes clancy:plan, adds clancy:build)
   ├─ Want changes? → 👤 Comment on ticket, then
   │    👤 /clancy:plan (auto-revises)
   └─ Start over? → 👤 /clancy:plan --fresh

   Repeat for each ticket that needs a plan.

   AFK mode: /clancy:plan --afk and /clancy:approve-plan --afk
   skip all confirmations for fully autonomous planning.
```

**Local path:**

```
👤 Run /clancy:plan --from .clancy/briefs/<brief>.md
   │
   ├─ Reads the brief + codebase
   └─ Writes plan(s) to .clancy/plans/<plan-id>.md

👤 Review .clancy/plans/<plan-id>.md
   │
   ├─ Want changes? → 👤 re-run /clancy:plan --from or edit directly
   └─ Happy? → 👤 /clancy:approve-plan .clancy/plans/<plan-id>.md
         (writes sibling .approved marker with SHA-256 of the plan file —
          the gate every local implementation checks)
```

---

## Implementation Phase

### Interactive (one ticket at a time)

**Board path:**

```
👤 Run /clancy:implement
   │
   ├─ Lock check + resume detection
   ├─ Preflight + board detection
   ├─ Epic completion check (auto)
   ├─ Rework detection (auto)
   ├─ Fetches next unblocked ticket
   │    (skips blocked tickets, skips HITL in AFK mode)
   ├─ Dry-run gate, feasibility check
   ├─ Creates feature branch from epic branch
   ├─ Transitions ticket → In Progress
   ├─ Claude implements the ticket
   │    (verification gate runs lint/test/typecheck)
   │    (self-healing retry if checks fail)
   ├─ Creates PR targeting epic branch
   ├─ Logs cost
   └─ Sends notification (if configured)

👤 Review the PR
   │
   ├─ Approve → 👤 Merge the PR (into epic branch)
   ├─ Request changes → 👤 Leave PR comments
   │    (inline comments auto-trigger rework,
   │     conversation comments need "Rework:" prefix)
   │    Next /clancy:implement auto-detects the rework
   └─ Close → ticket stays, Clancy moves on

👤 Repeat /clancy:implement for each ticket
```

**Local path:**

```
👤 Run /clancy:implement --from .clancy/plans/<plan-id>.md
   │
   ├─ Verifies the sibling .approved marker exists and matches SHA-256
   ├─ Creates a synthetic ticket from the plan (no board calls)
   ├─ Claude implements the plan
   │    (verification gate runs lint/test/typecheck, same as board path)
   ├─ Creates PR targeting CLANCY_BASE_BRANCH
   └─ Logs cost

👤 Review + merge the PR
```

### AFK Mode (autonomous batch)

**Board path:**

```
👤 Run /clancy:autopilot
   │
   ├─ Loops /clancy:implement up to MAX_ITERATIONS times
   ├─ Skips HITL tickets (picks AFK-only)
   ├─ Auto-resumes from crashes (lock file)
   ├─ Generates session report when done
   └─ Sends webhook notification (if configured)

👤 Come back later, review session report
   (.clancy/session-report.md)
👤 Review + merge PRs that were created
```

**Local path:**

```
👤 Run /clancy:implement --from .clancy/plans/ --afk
   │
   ├─ Naturally sorts every .md in the directory
   ├─ Skips plans without a matching .approved marker (warns)
   ├─ Implements each approved plan sequentially
   └─ Stops on first failure, reports a summary when done

👤 Come back later, review the batch summary and merge PRs
```

`/clancy:autopilot` itself requires a board — the local batch equivalent is `/clancy:implement --from <dir> --afk`.

---

## HITL Tickets (human-in-the-loop)

Tickets tagged HITL are skipped by `/clancy:autopilot`.

```
👤 Run /clancy:implement interactively for HITL tickets
   (Clancy may ask questions during implementation)
👤 Provide credentials, design decisions, etc. as needed
👤 Review + merge the PR
```

---

## Epic Completion (automatic)

After all child PRs are merged into the epic branch:

```
Next /clancy:implement or /clancy:autopilot iteration:
   ├─ Epic completion phase detects all children complete
   ├─ Auto-creates PR from epic/{key} → base branch
   ├─ GitHub: PR includes Closes keywords for parent + all children
   │    (merging auto-closes all issues)
   └─ Logs EPIC_PR_CREATED

👤 Review the epic PR (full feature landing on base branch)
👤 Merge the epic PR → all issues auto-closed (GitHub)
```

---

## Pipeline Label Flow

Labels control which role picks up a ticket. Each transition is atomic — the new label is added before the old one is removed (crash-safe ordering).

```
┌─────────────┐     /clancy:brief      ┌─────────────┐
│  (no label)  │ ───────────────────▶  │ clancy:brief │
└─────────────┘                        └──────┬──────┘
                                              │
                              /clancy:approve-brief
                                              │
                         ┌────────────────────┤
                         │                    │
                    (--skip-plan          (planner
                     or no planner)       enabled)
                         │                    │
                         ▼                    ▼
                  ┌─────────────┐     ┌─────────────┐
                  │ clancy:build │     │ clancy:plan  │
                  └─────────────┘     └──────┬──────┘
                         ▲                    │
                         │        /clancy:approve-plan
                         │                    │
                         └────────────────────┘

                  ┌─────────────┐
                  │ clancy:build │ ◀── implementation queue
                  └──────┬──────┘
                         │
                    /clancy:implement
                    /clancy:autopilot
                         │
                         ▼
                  ┌─────────────┐
                  │  (no label)  │     label removed after
                  └─────────────┘     ticket is picked up
```

**Guard rules:**

- A ticket with BOTH `clancy:plan` and `clancy:build` is skipped (dual-label race protection during add-before-remove transitions).
- In AFK mode, tickets with `clancy:hitl` are excluded from all queues.
- `CLANCY_LABEL_BUILD` / `CLANCY_LABEL_PLAN` / `CLANCY_LABEL_BRIEF` env vars override the default label names.

---

## Human Touchpoints Summary

| Step                                       | Human action                      | Required?        |
| ------------------------------------------ | --------------------------------- | ---------------- |
| Create ticket                              | Write the vague idea on the board | Yes              |
| `/clancy:brief`                            | Run the command                   | Yes              |
| Grill answers                              | Answer Clancy's questions         | Interactive only |
| Review brief                               | Read, give feedback or approve    | Yes              |
| `/clancy:approve-brief`                    | Confirm ticket creation           | Yes              |
| `/clancy:plan`                             | Run if ticket needs a plan        | Optional         |
| Review plan                                | Read, give feedback or approve    | If planning      |
| `/clancy:implement` or `/clancy:autopilot` | Start implementation              | Yes              |
| Review PRs                                 | Approve or request changes        | Yes              |
| Merge PRs                                  | Click merge                       | Yes              |
| HITL tickets                               | Interactive implementation        | Only for HITL    |
| Epic PR review                             | Final feature review              | Yes              |

**Minimum touchpoints for a full epic:** create ticket → brief → approve-brief → run → review/merge PRs → merge epic PR. That's **6 interactions** for an entire feature.
