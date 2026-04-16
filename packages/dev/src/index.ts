/**
 * @chief-clancy/dev
 *
 * Autonomous Ralph Wiggum execution surface for Claude Code —
 * pick up tickets and execute them with judgment, optionally
 * in a loop. Standalone-installable; sits between core and
 * terminal in the dependency graph.
 */
export const PACKAGE_NAME = '@chief-clancy/dev' as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export type { AppendFn } from './types/progress.js';
export type { ConsoleLike, SpawnSyncFn, StdioValue } from './types/spawn.js';

// ─── Lifecycle re-exports ───────────────────────────────────────────────────

export { targetBranch, ticketBranch } from './lifecycle/branch.js';

export { resolveCommitType } from './lifecycle/commit-type.js';

export type { CostFs } from './lifecycle/cost/cost.js';
export { appendCostEntry } from './lifecycle/cost/cost.js';

export { deliverEpicToBase } from './lifecycle/deliver-epic/deliver-epic.js';

export { deliverViaPullRequest } from './lifecycle/deliver-ticket/deliver-ticket.js';

export { ensureEpicBranch } from './lifecycle/epic.js';

export { checkFeasibility } from './lifecycle/feasibility/feasibility.js';

export { formatDuration } from './lifecycle/format/format.js';

export { listPlanFiles } from './lifecycle/plan-file/list-plans.js';
export type {
  ListPlansFs,
  PlanFileEntry,
} from './lifecycle/plan-file/list-plans.js';
export {
  checkApprovalStatus,
  parsePlanFile,
  toSyntheticTicket,
} from './lifecycle/plan-file/plan-file.js';
export type { ApprovalFs } from './lifecycle/plan-file/plan-file.js';

export type { LockData, LockFs } from './lifecycle/lock.js';
export {
  deleteLock,
  deleteVerifyAttempt,
  isLockStale,
  readLock,
  writeLock,
} from './lifecycle/lock.js';

export type { FetchFn } from './lifecycle/pr-creation.js';
export { attemptPrCreation } from './lifecycle/pr-creation.js';

export type { PreflightDeps } from './lifecycle/preflight/preflight.js';
export { runPreflight } from './lifecycle/preflight/preflight.js';

export type { ProgressEntry, ProgressFs } from './lifecycle/progress.js';
export {
  appendProgress,
  countReworkCycles,
  findEntriesWithStatus,
  formatTimestamp,
  parseProgressFile,
} from './lifecycle/progress.js';

export { buildPrBody } from './lifecycle/pull-request/pr-body.js';

export type { QualityFs } from './lifecycle/quality/quality.js';
export {
  getQualityData,
  recordDelivery,
  recordRework,
} from './lifecycle/quality/quality.js';

export { detectResume, executeResume } from './lifecycle/resume/resume.js';

export {
  fetchReworkFromPrReview,
  postReworkActions,
} from './lifecycle/rework/rework.js';
export type { PlatformReworkHandlers } from './lifecycle/rework/rework-types.js';
export { resolvePlatformHandlers } from './lifecycle/rework/rework-handlers.js';

// ─── CLI bridge re-exports ─────────────────────────────────────────────────

export { invokeClaudePrint, invokeClaudeSession } from './cli-bridge.js';

// ─── Notify re-exports ─────────────────────────────────────────────────────

export { sendNotification } from './notify.js';

// ─── Agent re-exports ──────────────────────────────────────────────────────

export { aggregateVerdict } from './agents/aggregate.js';
export { invokeReadinessGrade } from './agents/invoke.js';
export { safeParseVerdict } from './agents/parse-verdict.js';
export { READINESS_CHECK_IDS, readinessVerdictSchema } from './agents/types.js';
export type {
  CheckColour,
  CheckResult,
  ReadinessCheckId,
  ReadinessVerdict,
} from './agents/types.js';

// ─── Artifact re-exports ──────────────────────────────────────────────────

export { atomicWrite, rotateFile } from './artifacts/atomic-write.js';
export type { AtomicFs } from './artifacts/atomic-write.js';

export { runPreflightBatch } from './artifacts/preflight-batch.js';
export type {
  BatchGradeOpts,
  BatchGradeResult,
  GradeOneFn,
} from './artifacts/preflight-batch.js';

export { writeReadinessReport } from './artifacts/readiness-report.js';
export type {
  ReportData,
  WriteReportOpts,
} from './artifacts/readiness-report.js';

// ─── Queue re-exports ─────────────────────────────────────────────────────

export { executeFixedCount, executeQueue } from './queue.js';
export type {
  ExecuteFixedCountOpts,
  ExecuteQueueOpts,
  IterationResult,
  LoopOutcome,
  QueueStopCondition,
} from './queue.js';

// ─── Stop condition re-exports ────────────────────────────────────────────

export { checkStopCondition, FATAL_ABORT_PHASES } from './stop-condition.js';

// ─── Execute re-exports ────────────────────────────────────────────────────

export { runSingleTicketByKey } from './execute/single.js';
export { parseReadinessFlags } from './execute/flags/readiness-flags.js';
export { runReadinessGate } from './execute/readiness/readiness-gate.js';
export type { SingleTicketDeps } from './execute/single.js';

// ─── Prompt builder re-exports ─────────────────────────────────────────────

export {
  buildPrompt,
  buildReworkPrompt,
  ticketLabel,
} from './prompt-builder.js';

// ─── Dep-factory re-exports ────────────────────────────────────────────────

export type { InvokePhaseDeps } from './dep-factory/invoke-phase.js';
export { makeInvokePhase } from './dep-factory/invoke-phase.js';
export { buildPipelineDeps } from './dep-factory/dep-factory.js';
export { resolveBuildLabel } from './dep-factory/build-label.js';

// ─── Pipeline re-exports ──────────────────────────────────────────────────

export { createContext, RunContext } from './pipeline/context.js';
export { runPipeline } from './pipeline/run-pipeline.js';
export type { PipelineDeps, PipelineResult } from './pipeline/run-pipeline.js';

export { branchSetup } from './pipeline/phases/branch-setup.js';
export type { BranchSetupDeps } from './pipeline/phases/branch-setup.js';
export { cleanupPhase } from './pipeline/phases/cleanup-phase.js';
export type { CleanupDeps } from './pipeline/phases/cleanup-phase.js';
export { costPhase } from './pipeline/phases/cost-phase.js';
export type { CostPhaseDeps } from './pipeline/phases/cost-phase.js';
export { deliverPhase } from './pipeline/phases/deliver-phase.js';
export type { DeliverPhaseDeps } from './pipeline/phases/deliver-phase.js';
export { dryRun } from './pipeline/phases/dry-run.js';
export { epicCompletion } from './pipeline/phases/epic-completion.js';
export type { EpicCompletionDeps } from './pipeline/phases/epic-completion.js';
export { feasibilityPhase } from './pipeline/phases/feasibility.js';
export type { FeasibilityPhaseDeps } from './pipeline/phases/feasibility.js';
export { lockCheck } from './pipeline/phases/lock-check.js';
export type { LockCheckDeps } from './pipeline/phases/lock-check.js';
export { prRetry } from './pipeline/phases/pr-retry.js';
export type { PrRetryDeps } from './pipeline/phases/pr-retry.js';
export { preflightPhase } from './pipeline/phases/preflight-phase.js';
export type { PreflightPhaseDeps } from './pipeline/phases/preflight-phase.js';
export { reworkDetection } from './pipeline/phases/rework-detection.js';
export type { ReworkDetectionDeps } from './pipeline/phases/rework-detection.js';
export { ticketFetch } from './pipeline/phases/ticket-fetch.js';
export type { TicketFetchDeps } from './pipeline/phases/ticket-fetch.js';
export { transition } from './pipeline/phases/transition.js';
export type { TransitionDeps } from './pipeline/phases/transition.js';
