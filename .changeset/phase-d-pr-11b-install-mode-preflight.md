---
'@chief-clancy/brief': minor
---

✨ feat(brief): standalone+board approve-brief — install-mode preflight + label-decision preamble

Two coupled changes to `/clancy:approve-brief` that close the standalone+board UX cliff:

**Step 1 install-mode preflight.** approve-brief now classifies into three install contexts using the same `.clancy/.env` and `.clancy/clancy-implement.js` probes as `/clancy:plan` and `/clancy:approve-plan`. Standalone (no `.clancy/.env`) hard-stops with a `/clancy:board-setup` message — unlike approve-plan which writes a local marker, approve-brief has nothing to do without a board (its job is to create tickets ON the board). Standalone+board and terminal modes both run normally. The strategist role check is now scoped to terminal-mode preflight only (standalone+board users have no `CLANCY_ROLES`).

**Step 6 pipeline label selection rule.** The 3-rule label-decision fallthrough that lived in the GitHub subsection is lifted into a Step 6 preamble that all six platform subsections delegate to. The new rule covers four cases in precedence order: `--skip-plan` flag → build, standalone+board → plan (regardless of `CLANCY_ROLES`), terminal+planner enabled → plan, terminal+planner not enabled → build. This fixes a real bug where standalone+board users (no `CLANCY_ROLES` set) were silently routed to the build queue, breaking the `/clancy:plan` flow. All six platform subsections now reference the preamble rather than re-enumerating it.

`packages/brief/README.md` gains an "Approving briefs" section mirroring the post-PR-9 plan README's three-mode shape (Standalone / Standalone+board / Terminal mode), without the `--push` / `--ticket` flag content (approve-brief introduces no new flags).
