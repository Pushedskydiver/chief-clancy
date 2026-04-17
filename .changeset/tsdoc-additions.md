---
'@chief-clancy/core': patch
'@chief-clancy/dev': patch
'@chief-clancy/terminal': patch
---

Add missing TSDoc to public-API symbols that were thin on semantics per CONVENTIONS.md §Code Style. `Cached.store` and `CachedMap.store` in `core/src/shared/cache.ts` — document overwrite semantics. `Board.validateInputs` in `core/src/types/board.ts` — clarify that validation is optional and document the error-message-or-undefined return shape. `runReadinessGate` in `dev/src/execute/readiness/readiness-gate.ts` — document green-immediate, red-immediate, yellow-retry behaviour and the subagent-override. `InstallPaths` + `RunInstallOptions` in `terminal/src/installer/install/install.ts` — cross-link to `resolveInstallPaths` for the canonical path shape and document `nonInteractive`/`now` semantics.
