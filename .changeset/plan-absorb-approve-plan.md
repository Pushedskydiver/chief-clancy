---
'@chief-clancy/plan': minor
'@chief-clancy/terminal': patch
---

Move `/clancy:approve-plan` (command + workflow) from `@chief-clancy/terminal`'s planner role into `@chief-clancy/plan`. Standalone installs (`npx @chief-clancy/plan`) now ship `approve-plan.md` alongside `plan.md` and `board-setup.md`. Terminal installs receive the same files via the existing `plan-content` installer module — `npx chief-clancy` users see no behaviour change. Workflow content is byte-identical to the previous terminal version; standalone-mode adaptation lands in the next PR.
