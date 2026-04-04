# Progress

## Session 51 Summary

### @chief-clancy/plan extraction — Phase A complete

**PR #195** — Scaffold @chief-clancy/plan package:

- Package scaffold matching brief's pattern: package.json (private: true), tsconfig, vitest, barrel export, CLI installer, installer module with tests
- Structural tests with empty expectations (content arrives in PR 2)
- Root config updates: eslint boundaries, knip, vitest, publint, attw

**PR #196** — Copy plan content + standalone adaptation:

- Plan command and workflow copied from terminal's planner role
- Full Step 1 rewrite: three-state mode detection (standalone / standalone+board / terminal)
- Standalone guard blocks board ticket and batch modes without credentials
- Step 5 (post plan as comment) gated on board credentials available
- /clancy:board-setup command + workflow adapted for plan package
- 20 new content assertion tests

**PR #197** — Terminal consumes plan — delete duplicates + wire sources:

- Deleted plan.md from terminal's planner role (approve-plan.md stays)
- New plan-content module mirroring brief-content (2 files, no agents)
- Extracted validateOptionalDirs into shared fs-guards
- Wired wrapper: @chief-clancy/plan dep + source dir resolution
- Updated role-filter and integration test fixtures

**PR #198** — Publish prep:

- Flipped private: false, changeset, README
- Copilot instructions updated with plan package
- @chief-clancy/plan ready for npm publish

Test counts: 1608 core, 834 terminal, 51 brief, 44 plan.

---

## Next: Phase B — Local brief input mode (PRs 5-6)

Plan doc: `.claude/plans/plan-package-extraction.md`

Adds `--from .clancy/briefs/slug.md` flag to `/clancy:plan` for fully offline planning from brief files. Plans saved to `.clancy/plans/`. Unlocks `brief → plan → implement` without any board.

### Build order (remaining standalone packages)

1. ~~`@chief-clancy/brief`~~ — **done**
2. ~~`@chief-clancy/plan`~~ — **done (Phase A)**
3. `@chief-clancy/design` — same pattern + Stitch integration
4. `@chief-clancy/dev` — extract from core when chat arrives
5. `@chief-clancy/cli` — interactive wizard
6. `@chief-clancy/chat` — conversational interface (Slack/Teams)
