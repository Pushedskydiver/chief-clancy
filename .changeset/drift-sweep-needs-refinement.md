---
'@chief-clancy/plan': patch
'@chief-clancy/terminal': patch
---

Fix documentation drift around the `needs-refinement` / `CLANCY_PLAN_LABEL` deprecation.

- `packages/plan/src/workflows/plan.md`: tighten empty-queue GitHub guidance — drop the redundant `needs-refinement` mention from the fallback parenthetical; keep `CLANCY_LABEL_PLAN` (default: `clancy:plan`) with `CLANCY_PLAN_LABEL` as legacy fallback.
- `packages/terminal/src/roles/setup/workflows/scaffold.md`: remove a stale `.env.example` block that presented `CLANCY_PLAN_LABEL="needs-refinement"` as current — the pipeline-labels block later in the same file already handles this correctly via `CLANCY_LABEL_PLAN="clancy:plan"` with the deprecated-var note.

Repo-internal docs (`docs/roles/PLANNER.md`) also updated to match the canonical form in `docs/guides/CONFIGURATION.md`.
