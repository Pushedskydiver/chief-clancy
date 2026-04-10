# /clancy:dev

Run the autonomous development pipeline for a single ticket. Fetches the ticket from the board, runs readiness checks, executes implementation, and delivers the result.

Accepts arguments:

- **Board ticket:** `/clancy:dev PROJ-123`, `/clancy:dev #42`, `/clancy:dev ENG-42` — execute a specific ticket
- **Bypass readiness:** `--bypass-readiness` — skip the readiness gate and execute immediately
- **AFK mode:** `--afk` — non-interactive mode (no human prompts)

Examples:

- `/clancy:dev PROJ-123` — execute a Jira ticket
- `/clancy:dev #42` — execute a GitHub issue
- `/clancy:dev ENG-42` — execute a Linear issue
- `/clancy:dev --bypass-readiness PROJ-123` — skip readiness checks

@.claude/clancy/workflows/dev.md

Follow the dev workflow above. Execute the ticket through the autonomous pipeline — preflight, readiness, implementation, and delivery.
