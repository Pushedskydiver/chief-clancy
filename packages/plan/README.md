# @chief-clancy/plan

**Implementation planner for Claude Code.**

[![npm](https://img.shields.io/npm/v/@chief-clancy/plan?style=for-the-badge&color=cb3837)](https://www.npmjs.com/package/@chief-clancy/plan) [![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](https://github.com/Pushedskydiver/chief-clancy/blob/main/LICENSE)

```bash
npx @chief-clancy/plan
```

Fetch backlog tickets from your board, explore the codebase, and generate structured implementation plans posted as comments for human review. Works with board credentials — no full pipeline required.

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
2. **Configure board:** `/clancy:board-setup` — connect to your project board
3. **Run:** `/clancy:plan PROJ-123` — plan a specific ticket

Plans are posted as comments on the ticket for human review.

## Input modes

| Mode            | Example                                     | Board needed?               |
| --------------- | ------------------------------------------- | --------------------------- |
| Specific ticket | `/clancy:plan PROJ-123`, `/clancy:plan #42` | Yes (`/clancy:board-setup`) |
| Batch           | `/clancy:plan 3`                            | Yes (`/clancy:board-setup`) |
| Queue (default) | `/clancy:plan`                              | Yes (`/clancy:board-setup`) |

## Flags

| Flag      | Description                          |
| --------- | ------------------------------------ |
| `--afk`   | Auto-confirm all prompts             |
| `--fresh` | Discard existing plan and start over |

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
