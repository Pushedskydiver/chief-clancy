# /clancy:plan

Fetch backlog tickets from the board, explore the codebase, and generate structured implementation plans. Plans are posted as comments on the ticket for human review. With `--from`, plans from local brief files are saved to `.clancy/plans/` instead, with an optional board comment when credentials are available.

Accepts optional arguments:

- **From brief:** `/clancy:plan --from .clancy/briefs/slug.md` — plan from a local brief file. Cannot be combined with a ticket key or batch number.
- **Batch mode:** `/clancy:plan 3` — plan up to 3 tickets from the queue
- **Specific ticket:** `/clancy:plan PROJ-123`, `/clancy:plan #42`, `/clancy:plan ENG-42` — plan a single ticket by key
- **Fresh start:** `--fresh` — discard any existing plan and start over
- **Skip confirmations:** `--afk` — auto-confirm all prompts (for automation)

Examples:

- `/clancy:plan --from .clancy/briefs/add-dark-mode.md` — plan from a local brief
- `/clancy:plan` — plan 1 ticket from queue
- `/clancy:plan 3` — plan 3 tickets from queue
- `/clancy:plan PROJ-123` — plan a specific Jira/Linear ticket
- `/clancy:plan #42` — plan a specific GitHub issue
- `/clancy:plan --fresh PROJ-123` — discard existing plan and start over

@.claude/clancy/workflows/plan.md

Follow the plan workflow above. For each ticket or brief: run the feasibility scan, explore the codebase, and generate the plan. In board mode, post it as a comment. With `--from`, save it to `.clancy/plans/`. Do not implement anything — planning only.
