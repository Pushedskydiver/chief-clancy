---
'@chief-clancy/brief': minor
'@chief-clancy/terminal': patch
---

✨ feat(brief): absorb approve-brief from terminal strategist

Move `/clancy:approve-brief` command + workflow into `@chief-clancy/brief`,
making approve-brief installable via `npx @chief-clancy/brief --local` /
`--global` alongside `/clancy:brief` and `/clancy:board-setup`. The terminal
strategist directory is deleted entirely; strategist joins planner as a
virtual role (config-gate concept in `installer/ui.ts` + `brief-content.ts`,
no on-disk role files).

`@chief-clancy/terminal` is a patch because there's no public API change —
the workflow files moved are still installed by terminal via `brief-content.ts`,
just sourced from the brief package instead of a local strategist directory.
The `brief-content.ts` installer was refactored from scalar constants to
arrays to accommodate the second command/workflow file.
