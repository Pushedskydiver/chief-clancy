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
 */
export const FAILED_STATUSES: ReadonlySet<ProgressStatus> = new Set([
  'SKIPPED',
  'PUSH_FAILED',
  'TIME_LIMIT',
]);
