---
'@chief-clancy/core': patch
'@chief-clancy/dev': patch
'@chief-clancy/terminal': patch
---

Remove TSDoc blocks that restate signatures, per CONVENTIONS.md §Code Style "Delete TSDoc that restates the signature." Surgical preservation where the prose adds genuine semantics (e.g. "Creates the `.clancy` directory if needed", "Bold+blue for contrast on dark backgrounds"). No behaviour change; internal type inference unaffected. Covers `core/src/schemas/env.ts`, `core/src/types/board.ts`, `core/src/types/remote.ts`, `dev/src/lifecycle/lock.ts`, `dev/src/lifecycle/rework/rework.ts`, `dev/src/lifecycle/cost/cost.ts`, `dev/src/lifecycle/quality/quality.ts`, `terminal/src/shared/ansi.ts`, `terminal/src/runner/autopilot.ts`.
