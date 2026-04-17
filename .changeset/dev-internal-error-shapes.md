---
'@chief-clancy/dev': minor
---

**BREAKING** — Migrate 6 dev result shapes from `error: string` to the tagged house shape `{ kind: 'unknown'; message: string }` per CONVENTIONS.md §Error Handling. Minor bump (pre-1.0) — the shape change is observable through `@chief-clancy/dev`'s public `src/index.ts` re-exports (`ensureEpicBranch`, `executeResume`, `invokeReadinessGrade`) and the `PipelineDeps.branchSetup` type. Consumers must read `result.error.message` where they previously read `result.error`.

Migrated:

- `EnsureEpicResult` — both copies (`lifecycle/epic.ts` and the duplicate in `pipeline/phases/branch-setup.ts`)
- `BranchSetupResult` (`pipeline/phases/branch-setup.ts`) and the inline `PipelineDeps.branchSetup` contract in `pipeline/run-pipeline.ts`
- `ResumeExecResult` — both the real result in `lifecycle/resume/resume.ts` (now a proper discriminated union with `prResult?` only on the ok branch) and the narrow duplicate in `pipeline/phases/lock-check.ts`
- `ParseFailure` (`agents/parse-verdict.ts`)
- `InvokeResult` (`agents/invoke.ts`)
- `GradeResult` — both copies (`execute/readiness/readiness-gate.ts` and `artifacts/preflight-batch.ts`)

Cascade updates: `run-pipeline.ts` extracts `branch.error.message` for the string-typed `PipelineResult.error`; `readiness-gate.ts` extracts `result.error.message` for its outer `GateFailed.error`; `preflight-batch.ts` extracts `result.error.message` into the synthetic red verdict reason. Test assertions use `toMatchObject({ error: { kind, message } })` or `.error.message` after narrowing.

**Explicitly scoped out** (deferred for a follow-up sweep): the 5 other inline `{ ok: boolean; error?: string }` peer contracts in `PipelineDeps` (`preflight`, `ticketFetch`, `feasibility`, `invoke`, `deliver`). Only `branchSetup` was migrated in this PR because it was forced by the `BranchSetupResult` cascade; the rest are independent phase-result types and belong in a dedicated pipeline-phase sweep.
