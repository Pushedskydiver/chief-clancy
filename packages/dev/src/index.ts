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

export type {
  AppendFn,
  ConsoleLike,
  SpawnSyncFn,
  StdioValue,
} from './types/index.js';

// ─── Lifecycle re-exports ───────────────────────────────────────────────────

export {
  computeTargetBranch,
  computeTicketBranch,
} from './lifecycle/branch/index.js';

export { resolveCommitType } from './lifecycle/commit-type/index.js';

export type { CostFs } from './lifecycle/cost/cost.js';
export { appendCostEntry } from './lifecycle/cost/cost.js';

export { deliverEpicToBase } from './lifecycle/deliver-epic/deliver-epic.js';

export { deliverViaPullRequest } from './lifecycle/deliver-ticket/deliver-ticket.js';

export { ensureEpicBranch } from './lifecycle/epic/epic.js';

export { checkFeasibility } from './lifecycle/feasibility/feasibility.js';

export { formatDuration } from './lifecycle/format/format.js';

export type { LockData, LockFs } from './lifecycle/lock/index.js';
export {
  deleteLock,
  deleteVerifyAttempt,
  isLockStale,
  readLock,
  writeLock,
} from './lifecycle/lock/index.js';

export type { FetchFn } from './lifecycle/pr-creation/index.js';
export { attemptPrCreation } from './lifecycle/pr-creation/index.js';

export type { PreflightDeps } from './lifecycle/preflight/preflight.js';
export { runPreflight } from './lifecycle/preflight/preflight.js';

export type { ProgressEntry, ProgressFs } from './lifecycle/progress/index.js';
export {
  appendProgress,
  countReworkCycles,
  findEntriesWithStatus,
  formatTimestamp,
  parseProgressFile,
} from './lifecycle/progress/index.js';

export { buildPrBody } from './lifecycle/pull-request/pr-body/pr-body.js';

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
export type { PlatformReworkHandlers } from './lifecycle/rework/rework-handlers.js';
export { resolvePlatformHandlers } from './lifecycle/rework/rework-handlers.js';

// ─── CLI bridge re-exports ─────────────────────────────────────────────────

export { invokeClaudePrint, invokeClaudeSession } from './cli-bridge/index.js';

// ─── Notify re-exports ─────────────────────────────────────────────────────

export { sendNotification } from './notify/index.js';

// ─── Agent re-exports ──────────────────────────────────────────────────────

export { aggregateVerdict } from './agents/aggregate/index.js';
export { invokeReadinessGrade } from './agents/invoke/index.js';
export { safeParseVerdict } from './agents/parse-verdict/index.js';
export {
  READINESS_CHECK_IDS,
  readinessVerdictSchema,
} from './agents/types/index.js';
export type {
  CheckColour,
  CheckResult,
  ReadinessCheckId,
  ReadinessVerdict,
} from './agents/types/index.js';

// ─── Execute re-exports ────────────────────────────────────────────────────

export { runSingleTicketByKey } from './execute/index.js';
export { parseReadinessFlags } from './execute/flags/index.js';
export { runReadinessGate } from './execute/readiness/index.js';
export type { SingleTicketDeps } from './execute/index.js';

// ─── Prompt builder re-exports ─────────────────────────────────────────────

export {
  buildPrompt,
  buildReworkPrompt,
  ticketLabel,
} from './prompt-builder/index.js';

// ─── Dep-factory re-exports ────────────────────────────────────────────────

export type { InvokePhaseDeps } from './dep-factory/invoke-phase.js';
export { makeInvokePhase } from './dep-factory/invoke-phase.js';
export {
  buildPipelineDeps,
  resolveBuildLabel,
} from './dep-factory/dep-factory.js';

// ─── Pipeline re-exports ──────────────────────────────────────────────────

export { createContext, RunContext } from './pipeline/index.js';
export { runPipeline } from './pipeline/index.js';
export type { PipelineDeps, PipelineResult } from './pipeline/index.js';

export {
  branchSetup,
  cleanupPhase,
  costPhase,
  deliverPhase,
  dryRun,
  epicCompletion,
  feasibilityPhase,
  lockCheck,
  prRetry,
  preflightPhase,
  reworkDetection,
  ticketFetch,
  transition,
} from './pipeline/index.js';
export type {
  BranchSetupDeps,
  CleanupDeps,
  CostPhaseDeps,
  DeliverPhaseDeps,
  EpicCompletionDeps,
  FeasibilityPhaseDeps,
  LockCheckDeps,
  PreflightPhaseDeps,
  PrRetryDeps,
  ReworkDetectionDeps,
  TicketFetchDeps,
  TransitionDeps,
} from './pipeline/index.js';
