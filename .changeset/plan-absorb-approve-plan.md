---
'@chief-clancy/plan': minor
'@chief-clancy/terminal': patch
---

Move `/clancy:approve-plan` (command + workflow) from `@chief-clancy/terminal`'s planner role into `@chief-clancy/plan` as the new single source of truth. Terminal installs (`npx chief-clancy`) now source the same files via the existing `plan-content` installer module — terminal users see no behaviour change. The standalone installer (`npx @chief-clancy/plan`) deliberately does NOT ship `approve-plan.md` yet: the workflow content is currently board-only and would surface as a broken command for plan-standalone users. The next PR makes the workflow standalone-safe (three-state detection + local `.approved` marker) and wires it into the standalone installer at the same time. Workflow content is byte-identical to the previous terminal version.
