---
'@chief-clancy/dev': patch
---

Migrate dev-internal error result shapes to the tagged house shape `{ kind: 'unknown'; message: string }` per CONVENTIONS.md §Error Handling. All changed types are package-internal (not exported on the public surface) so this is a dev-patch release.

Migrated:

- `EnsureEpicResult` (both copies — `lifecycle/epic.ts` and `pipeline/phases/branch-setup.ts`)
- `BranchSetupResult` (`pipeline/phases/branch-setup.ts`) and its inline `PipelineDeps.branchSetup` contract in `pipeline/run-pipeline.ts`
- `ResumeExecResult` (`lifecycle/resume/resume.ts`)
- `ParseFailure` (`agents/parse-verdict.ts`)
- `InvokeResult` (`agents/invoke.ts`)
- `GradeResult` (mirrors `InvokeResult` in `execute/readiness/readiness-gate.ts` and `artifacts/preflight-batch.ts`)

Cascade updates: `run-pipeline.ts` extracts `branch.error.message` for the string-typed `PipelineResult.error`; `readiness-gate.ts` extracts `result.error.message` for its outer `GateResult.error`; `preflight-batch.ts` extracts `result.error.message` into the synthetic red verdict. Test assertions use `toMatchObject({ error: { kind: 'unknown', message: expect.stringContaining(...) } })` where narrowing isn't already present; `.error.message` field access where narrowing works.
