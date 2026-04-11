/**
 * Pipeline stop-condition logic for autopilot loops.
 *
 * Determines whether a {@link PipelineResult} should halt the loop.
 * Fatal abort phases (lock-check, preflight, ticket-fetch, branch-setup)
 * stop immediately; non-fatal aborts allow the next ticket.
 */
import type { PipelineResult } from './pipeline/index.js';
import type { QueueStopCondition } from './queue.js';

/** Phases where an abort should stop the entire autopilot loop. */
const FATAL_ABORT_PHASES = new Set([
  'lock-check',
  'preflight',
  'ticket-fetch',
  'branch-setup',
]);

/**
 * Check whether a pipeline result should stop the autopilot loop.
 *
 * Completed and resumed results continue. Errors and dry-runs stop.
 * Aborts stop only for fatal phases (preflight, ticket-fetch, etc.);
 * non-fatal aborts (feasibility, invoke) allow the next ticket.
 *
 * @param result - The pipeline result to check.
 * @returns Stop flag and optional reason.
 */
function checkStopCondition(result: PipelineResult): QueueStopCondition {
  switch (result.status) {
    case 'completed':
    case 'resumed':
      return { stop: false };

    case 'error':
      return { stop: true, reason: result.error ?? 'Unknown error' };

    case 'dry-run':
      return { stop: true, reason: 'Dry run — loop not applicable' };

    case 'aborted': {
      const isFatal = FATAL_ABORT_PHASES.has(result.phase ?? '');
      return isFatal
        ? { stop: true, reason: `Aborted at ${result.phase}` }
        : { stop: false };
    }

    default: {
      const _exhaustive: never = result.status;
      return _exhaustive;
    }
  }
}

export { checkStopCondition, FATAL_ABORT_PHASES };
