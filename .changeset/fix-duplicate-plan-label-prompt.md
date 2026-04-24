---
'@chief-clancy/terminal': patch
---

Fix duplicate `CLANCY_LABEL_PLAN` write to `.clancy/.env` on `npx chief-clancy` init (GitHub + Planner) and in the `/clancy:settings` menu.

Root cause: two separate prompts in the init and settings workflows both wrote to `CLANCY_LABEL_PLAN` with different defaults (`clancy:plan` vs `needs-refinement`) — the second write created a duplicate key, which agent-Claude then had to patch up (and could drop adjacent env vars in the process on larger `.env` files).

Removed the redundant GitHub-only prompts in both workflows. Pipeline Labels (Step 4c-2 in init, `[L2]` in settings) is now the single source of truth for `CLANCY_LABEL_PLAN`. Jira (`CLANCY_PLAN_STATUS`) and Linear (`CLANCY_PLAN_STATE_TYPE`) branches unchanged — those are genuinely distinct concepts.
