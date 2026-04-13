# /clancy:help

List all Clancy commands with descriptions.

Display the following:

---

## Clancy — autonomous development for Claude Code

Named after Chief Clancy Wiggum (Ralph's dad, The Simpsons). Built on the Ralph technique
coined by Geoffrey Huntley (ghuntley.com/ralph/). Clancy extends that foundation with board
integration (6 boards), structured codebase docs, and a git workflow built for team development.

**Supported boards:** Jira, GitHub Issues, Linear, Shortcut, Notion, Azure DevOps

### Planner _(optional — enable via `CLANCY_ROLES=planner` in `.clancy/.env`)_

| Command                 | Description                                                 |
| ----------------------- | ----------------------------------------------------------- |
| `/clancy:plan`          | Refine backlog tickets into structured implementation plans |
| `/clancy:plan 3`        | Plan up to 3 tickets in batch mode                          |
| `/clancy:plan PROJ-123` | Plan a specific ticket by key (also `#42`, `ENG-42`)        |
| `/clancy:plan --fresh`  | Discard any existing plan and start from scratch            |
| `/clancy:approve-plan`  | Promote an approved plan to the ticket description          |

### Strategist _(optional — enable via `CLANCY_ROLES=strategist` in `.clancy/.env`)_

| Command                 | Description                                                   |
| ----------------------- | ------------------------------------------------------------- |
| `/clancy:brief`         | Generate a strategic brief (research + grill + decomposition) |
| `/clancy:approve-brief` | Convert a brief into tickets on the board                     |

### Implementer

| Command                | Description                                                     |
| ---------------------- | --------------------------------------------------------------- |
| `/clancy:implement`    | Pick up one ticket and stop — good for first runs and debugging |
| `/clancy:autopilot`    | Run in loop mode until queue is empty or MAX_ITERATIONS hit     |
| `/clancy:autopilot 20` | Same, but override MAX_ITERATIONS to 20 for this session        |
| `/clancy:dry-run`      | Preview next ticket without making any changes                  |

### Reviewer

| Command          | Description                                                |
| ---------------- | ---------------------------------------------------------- |
| `/clancy:review` | Score next ticket (0–100%) with actionable recommendations |
| `/clancy:status` | Show next tickets without running — read-only board check  |
| `/clancy:logs`   | Format and display .clancy/progress.txt                    |

### Setup & Maintenance

| Command                      | Description                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| `/clancy:init`               | Wizard — choose board, collect config, scaffold everything, offer map-codebase     |
| `/clancy:settings`           | View and change configuration — model, iterations, board, and more                 |
| `/clancy:doctor`             | Diagnose your setup — test every integration and report what's broken              |
| `/clancy:map-codebase`       | Full 5-agent parallel codebase scan, writes all 10 docs                            |
| `/clancy:update-docs`        | Incremental refresh — re-runs agents for changed areas only                        |
| `/clancy:update-terminal`    | Update the full Clancy pipeline to latest version via npx                          |
| `/clancy:uninstall-terminal` | Remove the full Clancy pipeline — commands, hooks, settings, optionally `.clancy/` |
| `/clancy:help`               | This screen                                                                        |

### How it works

Clancy supports two paths:

**With a board** — autonomous loop over a Kanban queue:

1. `/clancy:init` — connect your board and scaffold `.clancy/`
2. `/clancy:map-codebase` — generate codebase docs (or say yes during init)
3. `/clancy:dry-run` → `/clancy:implement` → `/clancy:autopilot`

**Without a board** — local plan-driven flow:

1. `/clancy:init` — answer No when asked about a board
2. `/clancy:map-codebase` — generate codebase docs
3. `/clancy:brief` → `/clancy:plan --from` → `/clancy:approve-plan` → `/clancy:implement --from .clancy/plans/<plan>.md`

Step 3 of the local path requires the Strategist role (for `/clancy:brief`) and the Planner role (for `/clancy:plan`) — enable the relevant role(s) during `/clancy:init` or via `/clancy:settings` (typically both for the full local path).

Either way, Clancy picks one unit of work per loop, fresh context every iteration. No context rot.

### Links

- GitHub: github.com/Pushedskydiver/chief-clancy
- Issues: github.com/Pushedskydiver/chief-clancy/issues
- Lineage: ghuntley.com/ralph/

---

Show this output exactly. Do not add, remove, or reformat any content.
