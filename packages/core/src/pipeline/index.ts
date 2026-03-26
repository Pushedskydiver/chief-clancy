export { createContext, RunContext } from './context.js';
export { runPipeline } from './run-pipeline.js';
export type { PipelineDeps, PipelineResult } from './run-pipeline.js';

// Phase functions + deps types (consumed by terminal dep factory)
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
} from './phases/index.js';
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
} from './phases/index.js';
