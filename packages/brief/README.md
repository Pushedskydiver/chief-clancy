# @chief-clancy/brief

**Strategic brief generator for Claude Code.**

[![npm](https://img.shields.io/npm/v/@chief-clancy/brief?style=for-the-badge&color=cb3837)](https://www.npmjs.com/package/@chief-clancy/brief) [![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](https://github.com/Pushedskydiver/chief-clancy/blob/main/LICENSE)

```bash
npx @chief-clancy/brief
```

Turn feature ideas into structured strategic briefs with vertical-slice ticket decomposition. Works standalone — no board credentials, no pipeline, no config required.

## What it does

The `/clancy:brief` slash command researches your codebase, grills you (or itself) on requirements, and produces a brief document with:

- Problem statement and goals
- Discovery Q&A from the grill phase
- User stories
- Technical considerations
- Ticket decomposition table (vertical slices, sized, with dependencies)
- Open questions and risks

## How it works

1. **Install:** `npx @chief-clancy/brief` — choose global or local
2. **Run:** `/clancy:brief "Add dark mode support"` — inline text
3. **Or from a file:** `/clancy:brief --from docs/rfc.md`

Briefs are saved to `.clancy/briefs/` in your project.

## Input modes

| Mode         | Example                                       | Board needed?               |
| ------------ | --------------------------------------------- | --------------------------- |
| Inline text  | `/clancy:brief "Add dark mode"`               | No                          |
| From file    | `/clancy:brief --from docs/rfc.md`            | No                          |
| Board ticket | `/clancy:brief #42`, `/clancy:brief PROJ-123` | Yes (`/clancy:board-setup`) |
| Batch        | `/clancy:brief 3`                             | Yes (`/clancy:board-setup`) |
| Interactive  | `/clancy:brief`                               | No                          |

## Flags

| Flag            | Description                           |
| --------------- | ------------------------------------- |
| `--afk`         | AI-grill instead of human interview   |
| `--fresh`       | Discard existing brief and start over |
| `--research`    | Include web research in analysis      |
| `--from <path>` | Brief from a local file               |
| `--epic <KEY>`  | Set parent for ticket creation        |
| `--list`        | Show inventory of existing briefs     |

## Board ticket mode (optional)

To brief from board tickets without installing the full pipeline:

1. Run `/clancy:board-setup` in Claude Code
2. Follow the prompts to configure your board credentials
3. Run `/clancy:brief #42` (or your board's ticket format)

Credentials are stored in `.clancy/.env` and are per-project (not global).

Supported boards: Jira, GitHub Issues, Linear, Shortcut, Notion, Azure DevOps.

## Approving briefs

The brief package ships `/clancy:approve-brief` so the approval gate works without the full pipeline. The behaviour depends on the install mode.

### Standalone (no board)

`/clancy:approve-brief` requires board credentials. Approve-brief's job is to create child tickets ON the board, so without a board there is nothing for it to do. Run `/clancy:board-setup` first to configure your board, then re-run `/clancy:approve-brief`.

### Standalone+board (board credentials but no full pipeline)

`/clancy:approve-brief <slug>` walks the brief's decomposition table, creates one child ticket per row on the board (in topological/dependency order), links dependencies, and posts a tracking summary as a comment on the parent ticket. Each child ticket gets a pipeline label so downstream queue commands (`/clancy:plan`, `/clancy:implement`) know which queue picks it up.

In standalone+board mode, child tickets default to `CLANCY_LABEL_PLAN` (default `clancy:plan`), even though `CLANCY_ROLES` is unset — passing `--skip-plan` overrides this and forces `CLANCY_LABEL_BUILD` (default `clancy:build`) instead. This is the **single-source-of-truth pipeline label rule**: standalone+board users have installed both `@chief-clancy/brief` and `@chief-clancy/plan` as standalone packages and clearly intend to use plan, so the workflow defaults to the planning queue rather than the build queue.

Partial failures stop immediately. The brief file's approve marker tracks which rows already shipped to the board, so re-running `/clancy:approve-brief` resumes from where the previous run stopped — it never duplicates a ticket.

### Terminal mode (full pipeline)

Existing behaviour, unchanged. The pipeline label respects `CLANCY_ROLES`: if `planner` is enabled (or `CLANCY_ROLES` is unset, indicating a global install), child tickets get `CLANCY_LABEL_PLAN`; if `planner` is explicitly excluded, child tickets get `CLANCY_LABEL_BUILD` (the terminal user has opted out of the planning queue). The `--skip-plan` flag overrides both and forces the build label.

## Uninstalling

Run `/clancy:uninstall-brief` in Claude Code. It removes brief-exclusive files (commands, workflows, devils-advocate agent, VERSION marker), then checks for other installed Clancy packages before removing shared files (board-setup, scan agents, map-codebase, update-docs). Leaves `.clancy/.env` untouched.

## Full pipeline

`@chief-clancy/brief` covers brief generation and ticket creation from briefs. For planning and the full development pipeline (autopilot, implementation, review), install the complete Clancy package:

```bash
npx chief-clancy
```

## Also included

Installing `@chief-clancy/brief` also installs codebase scanning commands from [`@chief-clancy/scan`](https://www.npmjs.com/package/@chief-clancy/scan):

- `/clancy:map-codebase` — scan your codebase with 5 parallel agents and generate `.clancy/docs/`
- `/clancy:update-docs` — incrementally refresh docs affected by recent changes

Running `/clancy:map-codebase` before briefing enriches the devil's advocate analysis with real codebase context.

## Part of the Clancy monorepo

- [`chief-clancy`](https://www.npmjs.com/package/chief-clancy) — full pipeline (install, configure, implement, autopilot)
- [`@chief-clancy/dev`](https://www.npmjs.com/package/@chief-clancy/dev) — standalone ticket executor
- [`@chief-clancy/scan`](https://www.npmjs.com/package/@chief-clancy/scan) — codebase scanning agents and workflows
- [`@chief-clancy/plan`](https://www.npmjs.com/package/@chief-clancy/plan) — implementation planner
- [`@chief-clancy/terminal`](https://www.npmjs.com/package/@chief-clancy/terminal) — installer, slash commands, hooks, runners
- [`@chief-clancy/core`](https://www.npmjs.com/package/@chief-clancy/core) — board integrations, pipeline phases, schemas

## Credits

Built on the [Ralph technique](https://ghuntley.com/ralph/) by Geoffrey Huntley. See [CREDITS.md](https://github.com/Pushedskydiver/chief-clancy/blob/main/CREDITS.md).

## License

MIT — see [LICENSE](https://github.com/Pushedskydiver/chief-clancy/blob/main/LICENSE).
