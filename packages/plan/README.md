# @chief-clancy/plan

**Implementation planner for Claude Code.**

[![npm](https://img.shields.io/npm/v/@chief-clancy/plan?style=for-the-badge&color=cb3837)](https://www.npmjs.com/package/@chief-clancy/plan) [![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](https://github.com/Pushedskydiver/chief-clancy/blob/main/LICENSE)

```bash
npx @chief-clancy/plan
```

Generate structured implementation plans for your codebase. Plan from board tickets (posted as ticket comments) or fully offline from local Clancy briefs (saved to `.clancy/plans/`). No full pipeline required.

## What it does

The `/clancy:plan` slash command explores your codebase, runs a feasibility scan, and produces a plan with:

- Summary and implementation approach
- Affected files table (file, change type, description)
- Test strategy (specific tests to write)
- Acceptance criteria (testable conditions)
- Dependencies and blockers
- Risks and considerations
- Size estimate (S/M/L)

## How it works

1. **Install:** `npx @chief-clancy/plan` — choose global or local
2. **Pick an input source:**
   - **Board tickets** — run `/clancy:board-setup` to configure credentials, then `/clancy:plan PROJ-123`. Plans are posted as comments on the ticket.
   - **Local briefs** — point at a Clancy brief file with `/clancy:plan --from .clancy/briefs/<brief>.md`. Plans are saved to `.clancy/plans/<slug>-<row>.md`.
3. **Review and revise:** add a `## Feedback` section to the plan (board comment or local file), then re-run `/clancy:plan` to revise.

## Input modes

| Mode            | Example                                               | Board needed?               |
| --------------- | ----------------------------------------------------- | --------------------------- |
| Local brief     | `/clancy:plan --from .clancy/briefs/add-dark-mode.md` | No                          |
| Specific ticket | `/clancy:plan PROJ-123`, `/clancy:plan #42`           | Yes (`/clancy:board-setup`) |
| Batch           | `/clancy:plan 3`                                      | Yes (`/clancy:board-setup`) |
| Queue (default) | `/clancy:plan`                                        | Yes (`/clancy:board-setup`) |

## Flags

| Flag                | Description                                                             |
| ------------------- | ----------------------------------------------------------------------- |
| `--from <path> [N]` | Plan from a local Clancy brief file. Optional row number targets a row. |
| `--afk`             | Auto-confirm all prompts. With `--from`, plans every unplanned row.     |
| `--fresh`           | Discard the existing plan and start over.                               |
| `--list`            | Show inventory of existing local plans in `.clancy/plans/` and stop.    |

## Local planning workflow

The `--from` flag lets you go from idea to implementation plan without ever touching a board:

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
```

Plans are tracked in the brief file itself via a `<!-- planned:1,2,3 -->` marker, so re-running advances to the next unplanned row automatically.

To approve and implement plans you'll need the full pipeline (`npx chief-clancy`).

## Board ticket mode

To plan from board tickets without installing the full pipeline:

1. Run `/clancy:board-setup` in Claude Code
2. Follow the prompts to configure your board credentials
3. Run `/clancy:plan PROJ-123` (or your board's ticket format)

Credentials are stored in `.clancy/.env` and are per-project (not global).

Supported boards: Jira, GitHub Issues, Linear, Shortcut, Notion, Azure DevOps.

## Full pipeline

For the complete development pipeline (brief, plan, implement, deliver), install the full Clancy package:

```bash
npx chief-clancy
```

## Part of the Clancy monorepo

- [`chief-clancy`](https://www.npmjs.com/package/chief-clancy) — full pipeline (install, configure, implement, autopilot)
- [`@chief-clancy/brief`](https://www.npmjs.com/package/@chief-clancy/brief) — strategic brief generator
- [`@chief-clancy/terminal`](https://www.npmjs.com/package/@chief-clancy/terminal) — installer, slash commands, hooks, runners
- [`@chief-clancy/core`](https://www.npmjs.com/package/@chief-clancy/core) — board integrations, pipeline phases, schemas

## Credits

Built on the [Ralph technique](https://ghuntley.com/ralph/) by Geoffrey Huntley. See [CREDITS.md](https://github.com/Pushedskydiver/chief-clancy/blob/main/CREDITS.md).

## License

MIT — see [LICENSE](https://github.com/Pushedskydiver/chief-clancy/blob/main/LICENSE).
