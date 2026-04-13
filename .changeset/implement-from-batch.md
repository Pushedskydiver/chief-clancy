---
'@chief-clancy/dev': minor
'@chief-clancy/terminal': patch
'@chief-clancy/plan': patch
'chief-clancy': patch
---

Add `--from` support to the implement pipeline for local plan execution.

**dev (minor):** Plan file parser (`parsePlanFile`, `checkApprovalStatus`, `toSyntheticTicket`), local-mode infrastructure (no-op board, synthetic config, local preflight), pipeline wiring for `--from`, directory listing with natural sort (`listPlanFiles`), and public API exports for all plan-file utilities.

**terminal (patch):** Batch runner (`runImplementBatch`) for `--from {directory} --afk`, implement entry point with directory detection and `--afk` dispatch, workflow and command docs for batch mode, e2e tests for local plan pipeline and lifecycle contracts.

**plan (patch):** README updated — replaced deferred `implement-from` text with shipped `--from` usage docs pointing at `@chief-clancy/dev`.

**chief-clancy (patch):** README updated — mentions `--from` local plan execution and adds step 5 to "How it works".
