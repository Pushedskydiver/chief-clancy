---
'@chief-clancy/plan': patch
---

`/clancy:plan --list` (Step 8 inventory) now shows live Approved/Stale status from the sibling `.approved` markers PR 7b writes. The Status column reads `.clancy/plans/{plan-id}.approved`, parses its `sha256=` line, hashes the current plan file the same way `/clancy:approve-plan` does, and reports one of three states:

- `Planned` — no marker exists yet
- `Approved` — marker exists and its `sha256` matches the current plan file
- `Stale (re-approve)` — marker exists but its `sha256` differs from the current plan file (the plan was edited after approval)

The inventory display switches from a column-aligned space-delimited layout to a pipe-delimited table so multi-word Status values like `Stale (re-approve)` are unambiguous to scan and parse. The footer hint now points at `/clancy:approve-plan` (which lives in the plan package after PR 7a/7b) instead of the previous "install the full pipeline" advice. The fourth state `Implemented` lands in PR 8.
