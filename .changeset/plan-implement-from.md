---
'@chief-clancy/plan': minor
'@chief-clancy/terminal': patch
---

New `/clancy:implement-from` command in the plan package — closes the local plan→approve→implement loop without requiring the terminal pipeline.

`/clancy:implement-from .clancy/plans/{stem}.md` (or the bare-stem form `/clancy:implement-from {stem}`) reads a local plan file, verifies the sibling `.approved` marker's SHA-256 matches the current plan content, parses the plan's `### Affected Files` table + `### Test Strategy` + `### Acceptance Criteria` + `### Implementation Approach` sections, and applies the changes via TDD vertical slices.

The approval gate is the load-bearing safeguard between "plan generated" and "code changes applied":

- **Marker absent** → block with `LOCAL_BLOCKED | not approved`
- **Marker malformed** (missing `sha256=` line, non-hex, wrong length) → block with `LOCAL_BLOCKED | malformed marker` and a delete-and-recreate hint
- **SHA matches** → proceed
- **SHA mismatches** (plan edited after approval) → block with `LOCAL_BLOCKED | sha mismatch`

The three `LOCAL_BLOCKED` qualifiers are distinct so a user grepping `.clancy/progress.txt` after an unattended `--afk` run can tell whether to look for plan-file edits (sha mismatch), just delete the marker (malformed), or run `/clancy:approve-plan` (not approved).

The new `--bypass-approval` flag opts out of the gate entirely. It is **required even when combined with `--afk`** — `--afk` alone does NOT bypass the gate, because warnings scroll past in non-interactive runs and the SHA check is the only safeguard between plan generation and code changes. Bypassed runs log `LOCAL_BYPASS | {N} files` instead of `LOCAL_IMPLEMENT | {N} files` so the audit trail records the bypass.

`/clancy:implement-from` and terminal's existing `/clancy:implement` are completely separate code paths. The new command does not create a board-ticket lock file (so the terminal verification gate's Stop hook does not fire — correct, because local implement is outside the verification-gate lifecycle), does not run pipeline phases, does not call board APIs, and does not commit. Use `/clancy:implement` for the board-driven flow with the full pipeline; use `/clancy:implement-from` for the local flow.

The terminal package's `plan-content` installer is updated to copy `implement-from.md` alongside `plan.md` and `approve-plan.md` so terminal users get the new command automatically alongside the existing planner role files.

The Step 8 inventory's fourth state (`Implemented`) — derived from `LOCAL_IMPLEMENT` entries in `.clancy/progress.txt` — lands in a follow-up PR (PR 8.1).
