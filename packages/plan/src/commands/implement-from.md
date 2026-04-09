# /clancy:implement-from

Implement a Clancy plan from a local plan file. Reads `.clancy/plans/{stem}.md`, verifies the plan was approved (the sibling `.approved` marker's SHA-256 must match the current plan file), and then applies the changes described in the plan's `### Affected Files`, `### Test Strategy`, `### Acceptance Criteria`, and `### Implementation Approach` sections.

This command is the local-loop counterpart to terminal's `/clancy:implement`. The two are completely separate code paths:

- **`/clancy:implement-from`** (this command, plan package): reads a local plan file, no board ticket, no lock file, no terminal verification gate. Use it when you ran `/clancy:plan --from {brief}` and `/clancy:approve-plan {stem}` and now want to apply the plan
- **`/clancy:implement`** (terminal-only): board-ticket-driven, runs the full pipeline (lockCheck, preflight, branchSetup, invoke, deliver, etc.). Requires `.clancy/clancy-implement.js`. Use it for the board-driven flow

The argument resolves in two forms:

- **Path:** `/clancy:implement-from .clancy/plans/add-dark-mode-2.md` — explicit path to the plan file
- **Bare stem:** `/clancy:implement-from add-dark-mode-2` — resolved against `.clancy/plans/{arg}.md`

The path form takes precedence on collision.

Examples:

- `/clancy:implement-from .clancy/plans/add-dark-mode-2.md` — implement an approved plan from the plans directory
- `/clancy:implement-from add-dark-mode-2` — same plan, bare-stem form
- `/clancy:implement-from add-dark-mode-2 --bypass-approval` — implement without checking the approval marker (see flag note below)

Optional flags:

- **Skip confirmations:** `--afk` — auto-confirm prompts (for automation). Does **NOT** bypass the approval gate
- **Bypass approval gate:** `--bypass-approval` — skip the SHA-256 marker check entirely. Required even when combined with `--afk` — `--afk` alone does NOT bypass the gate. Approval is the only safeguard between "plan generated" and "code changes applied", and warnings scroll past in non-interactive runs

@.claude/clancy/workflows/implement-from.md

Follow the implement-from workflow above. Resolve the argument, run the approval gate, parse the plan sections, and apply the changes. This is a local-only command — never call board APIs at any step. Do not advance ticket state, post comments, swap labels, or open PRs.
