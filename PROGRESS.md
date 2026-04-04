# Progress

## Session 50 Summary

### Terminal consumes brief + optional board support (complete)

**PR #190** — Delete strategist duplicates + wire bin script:

- Deleted `strategist/commands/brief.md` and `strategist/workflows/brief.md` (approve-brief.md stays in both)
- Wired `briefCommandsDir`/`briefWorkflowsDir`/`briefAgentsDir` in `bin/clancy.js` resolving from `@chief-clancy/brief`
- Added `@chief-clancy/brief: workspace:*` to `chief-clancy` package dependencies
- Updated role-filter and integration install test fixtures

**PR #191** — Refactor `bin/brief.js` to use file arrays (prep for board-setup)

**PR #192** — Add `/clancy:board-setup` command + workflow:

- New slash command and workflow for standalone board credential configuration
- Supports all 6 boards with credential collection, verification, and `.clancy/.env` writing
- Installer arrays updated in both `install.ts` and `bin/brief.js`
- 10 new content assertion tests

**PR #193** — Three-state mode detection:

- Standalone (no `.clancy/.env`) → board ticket mode blocked
- Standalone+board (`.clancy/.env` without `clancy-implement.js`) → board ticket mode works
- Terminal (both present) → full pipeline, unchanged
- Steps 10/10a now run when board credentials available (not just terminal mode)
- README updated with "Board ticket mode" section
- Copilot instructions updated with brief package and architecture rules
- Markdown added to lint-staged for auto-formatting on commit

Test counts: 1608 core, 822 terminal, 51 brief.

---

## Next: @chief-clancy/plan extraction

Plan doc: `.claude/plans/plan-package-extraction.md`

**Phase A** (PRs 1-4): Scaffold, copy + standalone adapt, terminal consumes, publish. Ships `/clancy:board-setup` in plan package (self-contained). Terminal changeset covers both brief and plan extraction work.

**Phase B** (PRs 5-6): `--from .clancy/briefs/slug.md` flag for fully local planning from brief files. Plans saved to `.clancy/plans/`. Unlocks `brief → plan → implement` without any board.

### Build order (remaining standalone packages)

1. ~~`@chief-clancy/brief`~~ — **done**
2. `@chief-clancy/plan` — same pattern as brief
3. `@chief-clancy/design` — same pattern + Stitch integration
4. `@chief-clancy/dev` — extract from core when chat arrives
5. `@chief-clancy/cli` — interactive wizard
6. `@chief-clancy/chat` — conversational interface (Slack/Teams)
