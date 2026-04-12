# @chief-clancy/dev

**Autonomous ticket executor for Claude Code.**

[![npm](https://img.shields.io/npm/v/@chief-clancy/dev?style=for-the-badge&color=cb3837)](https://www.npmjs.com/package/@chief-clancy/dev) [![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](../../LICENSE)

```bash
npx @chief-clancy/dev
```

Pick up tickets from your board and execute them autonomously — branch, implement, create PR. Works standalone with board credentials, or as part of the full Clancy pipeline.

## What it does

The `/clancy:dev` slash command fetches a ticket from your board, grades it through a 5-check readiness gate, and runs the full pipeline (branch setup, implementation, PR creation). The `/clancy:dev-loop` command processes multiple tickets in sequence with quiet hours, halt conditions, and structured artifact reporting.

## How it works

1. **Install:** `npx @chief-clancy/dev` — choose global or local
2. **Configure:** `/clancy:board-setup` — enter your board credentials
3. **Run one ticket:** `/clancy:dev PROJ-123` — grade and execute
4. **Or go AFK:** `/clancy:dev-loop --afk` — autonomous batch execution

## Modes

| Mode          | Command                               | Behaviour                                           |
| ------------- | ------------------------------------- | --------------------------------------------------- |
| Single ticket | `/clancy:dev PROJ-123`                | Grade one ticket, execute if green                  |
| AFK loop      | `/clancy:dev-loop --afk`              | Pre-flight grade all tickets, halt if any non-green |
| AFK strict    | `/clancy:dev-loop --afk --afk-strict` | Execute greens, defer yellows, halt on reds         |

## Flags

| Flag                 | Description                                      |
| -------------------- | ------------------------------------------------ |
| `--afk`              | Enable AFK mode (pre-flight grading, no prompts) |
| `--afk-strict`       | Execute only green tickets, defer yellows        |
| `--max=N`            | Cap the number of tickets to process             |
| `--max-batch=N`      | Cap the pre-flight batch size                    |
| `--bypass-readiness` | Skip the readiness gate                          |
| `--resume`           | Resume from a partial pre-flight checkpoint      |
| `--yes`              | Skip interactive cost confirmation               |

## Readiness gate

Every ticket is graded against a 5-check rubric before execution:

| Check             | Question                               |
| ----------------- | -------------------------------------- |
| **Clear**         | Is the ticket unambiguous?             |
| **Testable**      | Can success be verified with tests?    |
| **Small**         | Is it a single deliverable unit?       |
| **Locatable**     | Can the subagent find the right files? |
| **Touch-bounded** | Is the set of files to modify bounded? |

Green tickets execute. Yellow tickets prompt for clarification (or are deferred in `--afk-strict` mode). Red tickets halt.

## Artifacts

AFK loop runs produce structured artifacts in `.clancy/dev/`:

| Artifact              | Written when                | Description                                     |
| --------------------- | --------------------------- | ----------------------------------------------- |
| `readiness-report.md` | Pre-flight runs             | Colour-bucketed verdicts for all graded tickets |
| `run-summary.md`      | After execution             | Per-ticket status, timing, halt reason          |
| `deferred.json`       | `--afk-strict` with yellows | Deferred ticket ids and reasons                 |
| `drift.json`          | After execution (AFK modes) | Predicted vs actual changed files               |

Reports are rotated (last 3 kept). All writes are atomic (write-temp-rename).

## Board setup

To execute tickets from your board without the full pipeline:

1. Run `/clancy:board-setup` in Claude Code
2. Follow the prompts to configure your board credentials
3. Run `/clancy:dev PROJ-123` (or your board's ticket format)

Credentials are stored in `.clancy/.env` and are per-project (not global).

Supported boards: Jira, GitHub Issues, Linear, Shortcut, Notion, Azure DevOps.

## Full pipeline

`@chief-clancy/dev` covers autonomous ticket execution. For strategic briefing, planning, and the full development lifecycle, install the complete Clancy package:

```bash
npx chief-clancy
```

## Also included

Installing `@chief-clancy/dev` also installs codebase scanning commands from [`@chief-clancy/scan`](https://www.npmjs.com/package/@chief-clancy/scan):

- `/clancy:map-codebase` — scan your codebase with 5 parallel agents and generate `.clancy/docs/`
- `/clancy:update-docs` — incrementally refresh docs affected by recent changes

Running `/clancy:map-codebase` before executing tickets enriches the readiness grading with real codebase context.

## Part of the Clancy monorepo

- [`chief-clancy`](https://www.npmjs.com/package/chief-clancy) — full pipeline (install, configure, implement, autopilot)
- [`@chief-clancy/scan`](https://www.npmjs.com/package/@chief-clancy/scan) — codebase scanning agents and workflows
- [`@chief-clancy/brief`](https://www.npmjs.com/package/@chief-clancy/brief) — strategic brief generator
- [`@chief-clancy/plan`](https://www.npmjs.com/package/@chief-clancy/plan) — implementation planner
- [`@chief-clancy/terminal`](https://www.npmjs.com/package/@chief-clancy/terminal) — installer, slash commands, hooks, runners
- [`@chief-clancy/core`](https://www.npmjs.com/package/@chief-clancy/core) — board integrations, pipeline phases, schemas

## Credits

Built on the [Ralph technique](https://ghuntley.com/ralph/) by Geoffrey Huntley. See [CREDITS.md](https://github.com/Pushedskydiver/chief-clancy/blob/main/CREDITS.md).

## License

MIT — see [LICENSE](https://github.com/Pushedskydiver/chief-clancy/blob/main/LICENSE).
