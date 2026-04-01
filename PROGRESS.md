# Progress

## Session 49 Summary

### @chief-clancy/brief package (complete)

First standalone package in the monorepo — proves the lightweight installer pattern for non-developer audiences (PMs, designers, founders).

**PR #184** — Scaffold + installer:
- Package structure: `package.json`, `tsconfig.json` (with `~/b/` alias + `tsc-alias`), `vitest.config.ts`
- Copied markdown files from terminal: `brief.md` (command + workflow), `devils-advocate.md` (agent)
- Self-contained installer (`bin/brief.js`): copies 3 files to `.claude/`, global/local mode, workflow inlining, `VERSION.brief` marker, symlink rejection
- Pure TypeScript installer module (`install.ts`) with dependency injection for testability
- Config updates: eslint boundary rules, knip workspace, root vitest projects, publint/attw scripts
- 31 tests (structural + installer TDD)

**PR #185** — Standalone workflow adaptation:
- Step 1 rewritten: detects `.clancy/.env` for terminal vs standalone mode (no hard stops)
- Standalone board-ticket guard: graceful message when board credentials missing
- Steps 10 and 10a skip entirely in standalone mode
- Agent reference path updated to installed location (`.claude/clancy/agents/`)
- All 13 `/clancy:approve-brief` references conditionalised with standalone context
- 7 new content assertion tests

Published as `@chief-clancy/brief@0.1.0` on npm.

Test counts: 1608 core, 804 terminal, 38 brief.

---

## Next: Terminal consumes brief (PR 4)

Follow-up session scope:
- Add `@chief-clancy/brief: workspace:*` to terminal deps
- Update terminal installer to source strategist files from brief package
- Remove `src/roles/strategist/commands/brief.md` and `src/roles/strategist/workflows/brief.md` from terminal (approve-brief stays)
- Update `roles.test.ts`, eslint boundary rules, knip config

### Build order (remaining standalone packages)

1. ~~`@chief-clancy/brief`~~ — **done**
2. `@chief-clancy/plan` — same pattern as brief
3. `@chief-clancy/design` — same pattern + Stitch integration
4. `@chief-clancy/dev` — extract from core when chat arrives
5. `@chief-clancy/cli` — interactive wizard
6. `@chief-clancy/chat` — conversational interface (Slack/Teams)
