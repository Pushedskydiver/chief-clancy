# /clancy:dev-loop

Run the autonomous development loop. Fetches tickets from the board queue and processes them sequentially through the implementation pipeline.

Accepts arguments:

- **AFK mode:** `--afk` — non-interactive mode (no human prompts, autonomous execution)
- **Max iterations:** `--max=N` — limit the number of tickets to process (default: up to 50, hard cap: 100)
- **Bypass readiness:** `--bypass-readiness` — skip the readiness gate for all tickets

Environment variables (set in `.clancy/.env` or shell):

- `CLANCY_QUIET_START` / `CLANCY_QUIET_END` — quiet hours window (HH:MM, e.g. `22:00` / `06:00`)
- `CLANCY_NOTIFY_WEBHOOK` — webhook URL for loop completion notifications

Examples:

- `/clancy:dev-loop` — process queued tickets interactively (up to 50)
- `/clancy:dev-loop --afk` — process queued tickets autonomously (up to 50)
- `/clancy:dev-loop --afk --max=3` — process up to 3 tickets autonomously

@.claude/clancy/workflows/dev-loop.md

Follow the dev loop workflow above. Execute the ticket queue through the autonomous pipeline.
