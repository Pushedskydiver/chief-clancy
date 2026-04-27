/**
 * Progress log types and constants used by AFK runner and crash recovery.
 */

/** Progress log status values. */
export type ProgressStatus =
  | 'DONE'
  | 'SKIPPED'
  | 'PR_CREATED'
  | 'PUSHED'
  | 'PUSH_FAILED'
  | 'PR_CREATION_FAILED'
  | 'LOCAL'
  | 'PLAN'
  | 'APPROVE_PLAN'
  | 'REWORK'
  | 'EPIC_PR_CREATED'
  | 'BRIEF'
  | 'APPROVE_BRIEF'
  | 'TIME_LIMIT'
  | 'RESUMED';

/**
 * Statuses that indicate work has been delivered to the remote.
 * Used by crash recovery to detect already-delivered tickets.
 */
export const DELIVERED_STATUSES: ReadonlySet<ProgressStatus> = new Set([
  'PR_CREATED',
  'PUSHED',
  'REWORK',
  'RESUMED',
]);

/**
 * Statuses that indicate a ticket was successfully completed.
 * Used by AFK session reports to count completed tickets.
 */
export const COMPLETED_STATUSES: ReadonlySet<ProgressStatus> = new Set([
  'DONE',
  'PR_CREATED',
  'PUSHED',
  'EPIC_PR_CREATED',
  'RESUMED',
]);

/**
 * Statuses that indicate a failed or skipped ticket.
 * Used by AFK session reports to count failed tickets.
 *
 * `PR_CREATION_FAILED` belongs here (operator-visible failure surface),
 * not in `DELIVERED_STATUSES`: the branch is on the remote, but treating
 * the ticket as already-delivered would let `resume.ts` skip the manual
 * retry path. Operator-driven retry is the contract for this class.
 */
export const FAILED_STATUSES: ReadonlySet<ProgressStatus> = new Set([
  'SKIPPED',
  'PUSH_FAILED',
  'PR_CREATION_FAILED',
  'TIME_LIMIT',
]);
