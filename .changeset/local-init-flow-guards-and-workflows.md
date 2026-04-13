---
'@chief-clancy/dev': patch
'@chief-clancy/terminal': patch
---

Local-init-flow: board-optional path across the pipeline.

- **dev** — guard `detectBoard` crash paths so `loadEnv` returns undefined instead of exiting, and `dev.ts`/`loop-setup.ts` fall through to `runLocalMode` when `--from` is set. Exit code preserved via `return process.exit(1)` in `main()` on `loadEnv` failure (#288).
- **terminal** — `/clancy:init` gains a board-optional path with Step 3 board gate, conditional skips for board-specific sections, standalone git-host question (5 options incl. Azure DevOps), local-mode `.env.example` template, local-mode Step 5 enhancement list, and local-mode final output (#289). Settings, doctor, help, autopilot, status, and review are now local-mode aware: consistent 6-board detection, new `[B] Connect a board` and `[D] Disconnect board` menu options, doctor gains Shortcut/Notion/AzDO checks, status shows plan inventory gated by the real `.approved` marker, autopilot/review redirect to `/clancy:settings` or `/clancy:implement --from` in local mode (#290).
