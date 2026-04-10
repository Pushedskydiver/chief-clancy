# /clancy:board-setup

Configure board credentials for standalone dev usage. Connects your project to a Kanban board so you can execute tickets.

Not needed if you have the full Clancy pipeline installed (`npx chief-clancy`) — use `/clancy:settings` instead.

Supported boards: Jira, GitHub Issues, Linear, Shortcut, Notion, Azure DevOps.

@.claude/clancy/workflows/board-setup.md

Follow the board setup workflow above. Collect credentials, verify the connection, and write them to `.clancy/.env`.
