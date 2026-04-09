---
'@chief-clancy/plan': minor
---

✨ feat(plan): optional board push from `/clancy:approve-plan` (Phase C PR 9)

When approving a local plan-file stem in standalone+board mode (board credentials present alongside a local plan), `/clancy:approve-plan` can now push the approved plan to the source board ticket as a comment. Closes the "I have credentials and I want both modes" UX cliff: get the local marker AND the board comment in one approval.

New flags:

- `--push` — skip the interactive `[y/N]` prompt and push immediately. Combined with `--afk`, this is the unattended-automation path. Also the retry path for a previously failed push: `EEXIST + --push` falls through Step 4a's already-approved check and re-attempts the Step 4c push without re-writing the marker.
- `--ticket KEY` — override the `**Source:**` auto-detect from the plan file with an explicit key. Validated against the configured board's regex (one of six per-platform patterns: Jira `^[A-Z][A-Z0-9]+-\d+$`, GitHub `^#\d+$`, Linear `^[A-Z]+-\d+$`, Azure DevOps `^\d+$`, Shortcut `^\d+$`, Notion `^[0-9a-f]{32}$|^[0-9a-f-]{36}$`) before any push attempt.

Default interactive prompt is `[y/N]` (default No — never surprise-write to a board). All push failures (HTTP non-2xx, network, timeout, dns, auth) are best-effort: the local marker stays in place, `{stem} | BOARD_PUSH_FAILED | {http_status_or_error_class}` is logged to `.clancy/progress.txt`, and the exact retry command is printed for the user to copy.

The six platform comment-POST curl blocks are duplicated from `plan.md` Step 5b into `approve-plan.md` Step 4c between drift-prevention anchors — a workflow test byte-compares the two regions and fails on mismatch, so the duplication can never silently diverge.
