# /clancy:approve-plan

Approve a Clancy implementation plan. Behaviour depends on the install context and the argument:

- **Local plan file:** `/clancy:approve-plan add-dark-mode-2` — write a `.clancy/plans/{stem}.approved` marker (with the plan's SHA-256 + approval timestamp) and update the source brief's row marker. The marker is the gate `/clancy:implement-from` checks before applying changes
- **Board ticket:** `/clancy:approve-plan PROJ-123` — promote an approved plan from a ticket comment to the ticket description, edit the plan comment with an approval note, swap the ticket labels (`CLANCY_LABEL_PLAN` → `CLANCY_LABEL_BUILD`, both with sensible defaults), and — only if `CLANCY_STATUS_PLANNED` is configured — transition the ticket status. Requires board credentials. Runs in both standalone+board and terminal modes (the full pipeline is not required for the board transport flow itself; it is only required for downstream `/clancy:implement` to consume the result)
- **No argument:** auto-select the oldest unapproved plan. In standalone mode this scans `.clancy/plans/`; in standalone+board / terminal mode it scans `.clancy/progress.txt` for board tickets

The argument is **mode-aware**: in standalone+board / terminal modes, a plan-file lookup runs first (so `add-dark-mode-2` matches the local plan even if a board ticket happens to share the name). Plan stems win on collision.

Examples:

- `/clancy:approve-plan add-dark-mode-2` — approve a local plan from `/clancy:plan --from`
- `/clancy:approve-plan PROJ-123` — promote a board plan to the ticket description
- `/clancy:approve-plan` — auto-select the oldest pending approval

Optional flags:

- **Skip confirmation:** `--afk` — auto-confirm without prompting (for automation)

@.claude/clancy/workflows/approve-plan.md

Follow the approve-plan workflow above. Detect the install context, resolve the argument (plan-file stem or ticket key), and either write the local marker (Step 4a/4b) or run the existing board transport flow (Steps 5/5b/6). Do not implement anything — approval only.
