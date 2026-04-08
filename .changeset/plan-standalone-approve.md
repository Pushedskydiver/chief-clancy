---
'@chief-clancy/plan': minor
---

`/clancy:approve-plan` is now standalone-aware. Three-state Step 1 preflight detects standalone / standalone+board / terminal mode. Step 2 is a dual-mode resolver: in standalone mode the argument must be a plan-file stem (e.g. `add-dark-mode-2`); in standalone+board / terminal modes a plan-file lookup runs first, then ticket-key validation, with plan stems winning on collision.

New Step 4a writes a `.clancy/plans/{stem}.approved` marker via race-safe `O_EXCL` exclusive create. The marker body is two `key=value` lines:

```
sha256={hex sha256 of the plan file at approval time}
approved_at={ISO 8601 UTC timestamp}
```

The SHA-256 is the gate the upcoming `/clancy:implement-from` command checks before applying changes — drift between the marker's `sha256` and the current plan file's hash blocks implementation until re-approval. New Step 4b updates the source brief file's marker comment from `<!-- planned:1,2 -->` to `<!-- approved:1 planned:1,2 -->` (best-effort — failure does not roll back the local marker).

The standalone installer (`npx @chief-clancy/plan`) now ships `approve-plan.md` alongside `plan.md` and `board-setup.md` (deferred from PR 7a until the workflow was standalone-safe). Terminal users see no behaviour change — the existing 970-line board transport flow (Steps 5, 5b, 6) is preserved entirely for ticket-key inputs in terminal and standalone+board modes.
