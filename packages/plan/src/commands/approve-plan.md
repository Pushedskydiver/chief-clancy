# /clancy:approve-plan

Approve a Clancy implementation plan. Behaviour depends on the install context and the argument:

- **Local plan file:** `/clancy:approve-plan add-dark-mode-2` — write a `.clancy/plans/{stem}.approved` marker (with the plan's SHA-256 + approval timestamp) and update the source brief's row marker. The marker is the gate any plan-implementing tool checks before applying changes (a dedicated `/clancy:implement-from` slash command is deferred until `@chief-clancy/dev` is extracted)
- **Board ticket:** `/clancy:approve-plan PROJ-123` — promote an approved plan from a ticket comment to the ticket description, edit the plan comment with an approval note, swap the ticket labels (`CLANCY_LABEL_PLAN` → `CLANCY_LABEL_BUILD`, both with sensible defaults), and — only if `CLANCY_STATUS_PLANNED` is configured — transition the ticket status. Requires board credentials. Runs in both standalone+board and terminal modes (the full pipeline is not required for the board transport flow itself; it is only required for downstream `/clancy:implement` to consume the result)
- **No argument:** auto-select the oldest unapproved plan. In standalone mode this scans `.clancy/plans/`; in standalone+board / terminal mode it scans `.clancy/progress.txt` for board tickets

The argument is **mode-aware**: in standalone+board / terminal modes, a plan-file lookup runs first (so `add-dark-mode-2` matches the local plan even if a board ticket happens to share the name). Plan stems win on collision.

Examples:

- `/clancy:approve-plan add-dark-mode-2` — approve a local plan from `/clancy:plan --from`
- `/clancy:approve-plan PROJ-123` — promote a board plan to the ticket description
- `/clancy:approve-plan` — auto-select the oldest pending approval

Optional flags:

- **Skip confirmation:** `--afk` — auto-confirm without prompting (for automation)
- **Push approved plan to a board ticket:** `--push` — when approving a local plan stem in standalone+board mode, skip the interactive `[y/N]` prompt and push the approved plan to the source ticket as a comment immediately. Combined with `--afk`, this is the unattended-automation path. Without `--push`, an interactive approval still gets a `[y/N]` prompt (default No — never surprise-write to a board); an `--afk` approval without `--push` stays local-only and logs `LOCAL_ONLY` to `.clancy/progress.txt`. `--push` is also the **retry path** for a previously failed push: re-running `/clancy:approve-plan {stem} --push --ticket {KEY}` after a board push failure falls through Step 4a's `EEXIST` check (the marker stays in place) and re-attempts the Step 4c push.
- **Override the auto-detected ticket key:** `--ticket {KEY}` — bypass the `**Source:**` auto-detect from the plan file and push to the explicit `{KEY}` instead. The override `{KEY}` is validated against the configured board's regex before any push attempt — a malformed key is a hard error. Useful when the brief Source field is missing, ambiguous, or points at the wrong ticket. `--ticket` is **ignored** under `--afk` without `--push` (no push happens, so there is nothing to override).

@.claude/clancy/workflows/approve-plan.md

Follow the approve-plan workflow above. Detect the install context, resolve the argument (plan-file stem or ticket key), and either write the local marker (Step 4a/4b) followed by an optional board push (Step 4c) or run the existing board transport flow (Steps 5/5b/6). Do not implement anything — approval only.
