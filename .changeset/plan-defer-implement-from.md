---
'@chief-clancy/plan': patch
---

Defer the dedicated `/clancy:implement-from` slash command (originally scoped as Phase C PR 8) until `@chief-clancy/dev` is extracted. The plan package's README, `approve-plan.md` workflow, and `plan.md` Step 8 inventory are amended to reflect the deferral — concrete forward-references to `/clancy:implement-from` and "PR 8" are replaced with neutral wording about a future plan-implementing tool, and the success-message hint after `/clancy:approve-plan` now points users at "ask Claude to implement the plan, or run `npx chief-clancy` for the full pipeline" instead of a slash command that does not exist.

**Why:** the in-flight PR 8 implementation surfaced a cohesion concern. The plan package is supposed to _create_ plans, not _execute_ them — a slash command that reads a plan file and writes code is downstream consumption of planning output, not planning itself. A second-pass architectural review confirmed that:

- The original "layering" framing was overstated. PR 8's design was prompt-only (no heavy deps), so it didn't violate the documented `core ← terminal ← chief-clancy` direction. Both placements were technically legal
- The cohesion concern is real but the slash command is **convenience, not capability** — Claude Code can already do the SHA-256 gate + structured plan parse via natural-language instruction
- The documented natural home for code-applying tooling is `@chief-clancy/dev`, deferred until chat becomes a second consumer (see `docs/decisions/architecture/package-evolution.md` line ~114)
- Moving to terminal as `/clancy:implement --from` was considered and rejected — pays README + roadmap + decision-log churn now AND has to move again when `dev` lands. Worst of all worlds

**What ships unchanged:** PR 7b's `.clancy/plans/{stem}.approved` marker format. The two-line `sha256={hex}\napproved_at={ISO 8601}\n` body is preserved so the eventual `dev` consumer can plug in without re-approving every existing plan. The format is also human-readable for ad-hoc verification (a user or Claude Code can read the marker, hash the plan file, and refuse to apply on mismatch).

**What's deferred alongside PR 8:** the Step 8 inventory's fourth state (`Implemented`), originally PR 8.1 — wiring a reader for `LOCAL_IMPLEMENT` entries that no command writes is dead code until the consumer ships. Inventory continues to show three states: `Planned`, `Approved`, `Stale (re-approve)`.

**What's unaffected:** PR 9 (standalone+board push from approve-plan) and PR 10 (Phase C cleanup + docs sync) still ship as planned. Phase D's PR 11a/11b/12 (brief absorbs approve-brief) is also unaffected — approval is planning lifecycle (the gate between draft and ready), not execution, so the approve-\* moves stand on their own framing.

Closes #213 (the original PR 8 implementation, closed without merging).
