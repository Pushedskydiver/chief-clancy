# @chief-clancy/brief

**Strategic brief generator for Claude Code.**

[![npm](https://img.shields.io/npm/v/@chief-clancy/brief?style=for-the-badge&color=cb3837)](https://www.npmjs.com/package/@chief-clancy/brief) [![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](../../LICENSE)

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
4. **Or from a board ticket:** `/clancy:brief #42` (requires board credentials)

Briefs are saved to `.clancy/briefs/` in your project.

## Input modes

| Mode         | Example                                       | Board needed? |
| ------------ | --------------------------------------------- | ------------- |
| Inline text  | `/clancy:brief "Add dark mode"`               | No            |
| From file    | `/clancy:brief --from docs/rfc.md`            | No            |
| Board ticket | `/clancy:brief #42`, `/clancy:brief PROJ-123` | Yes           |
| Batch        | `/clancy:brief 3`                             | Yes           |
| Interactive  | `/clancy:brief`                               | No            |

## Flags

| Flag            | Description                           |
| --------------- | ------------------------------------- |
| `--afk`         | AI-grill instead of human interview   |
| `--fresh`       | Discard existing brief and start over |
| `--research`    | Include web research in analysis      |
| `--from <path>` | Brief from a local file               |
| `--epic <KEY>`  | Set parent for ticket creation        |
| `--list`        | Show inventory of existing briefs     |

## Standalone vs full pipeline

This package works on its own for inline text and file-based briefs. For board integration, ticket creation, and the full development pipeline, install the complete Clancy package:

```bash
npx chief-clancy
```

## Part of the Clancy monorepo

- [`chief-clancy`](https://www.npmjs.com/package/chief-clancy) — full pipeline (install, configure, implement, autopilot)
- [`@chief-clancy/terminal`](https://www.npmjs.com/package/@chief-clancy/terminal) — installer, slash commands, hooks, runners
- [`@chief-clancy/core`](https://www.npmjs.com/package/@chief-clancy/core) — board integrations, pipeline phases, schemas

## Credits

Built on the [Ralph technique](https://ghuntley.com/ralph/) by Geoffrey Huntley. See [CREDITS.md](https://github.com/Pushedskydiver/chief-clancy/blob/main/CREDITS.md).

## License

MIT — see [LICENSE](https://github.com/Pushedskydiver/chief-clancy/blob/main/LICENSE).
