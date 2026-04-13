# /clancy:implement

Pick up exactly one ticket from your Kanban board, implement it, commit, push, create a PR, and stop.

Good for:

- Your first run — watch Clancy work before going AFK
- Testing after changing .clancy/docs/ or CLAUDE.md
- Debugging a specific ticket
- When you only have time for one ticket

Pass `--dry-run` to preview what Clancy would do without making any changes:

- Shows the ticket, epic, target branch, and feature branch
- Exits before any git operations or Claude invocation

Pass `--from {path}` to implement a local plan file instead of a board ticket:

- Skips board credential checks and ticket fetch
- Parses the plan file for ticket key, title, and implementation details
- Works with or without `.clancy/.env` — creates a PR automatically when git host tokens are available, otherwise pushes the branch and you create the PR manually

@.claude/clancy/workflows/implement.md

Run one ticket as documented in the workflow above.
