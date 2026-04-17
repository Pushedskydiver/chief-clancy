---
'@chief-clancy/core': patch
'@chief-clancy/dev': patch
'@chief-clancy/terminal': patch
---

Add missing TSDoc to public-API symbols that were thin on semantics per CONVENTIONS.md §Code Style. `Cached`/`CachedMap` methods in `core/src/shared/cache.ts` (5 methods) — document `store` overwrites and `get` returns `undefined` when absent. `Board.validateInputs` in `core/src/types/board.ts` — clarify the error-message-or-undefined return shape. `runReadinessGate` in `dev/src/execute/readiness/readiness-gate.ts` — document green-immediate, red-immediate, yellow-retry behaviour and the subagent-override. `InstallPaths` + `RunInstallOptions` in `terminal/src/installer/install/install.ts` — document mode-dependent resolution and `nonInteractive`/`now` semantics.
