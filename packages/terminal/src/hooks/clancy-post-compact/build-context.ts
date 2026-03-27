/**
 * Post-compact context builder.
 *
 * Constructs the context restoration message from lock file data
 * after Claude's context window is compacted. Ensures the agent
 * retains ticket context and continues without starting over.
 */
import type { LockData } from '../shared/types.js';

const MAX_DESCRIPTION_LENGTH = 2000;

/**
 * Build the context restoration string from lock file data.
 *
 * Returns `null` if required fields (`ticketKey`, `ticketBranch`)
 * are missing — the hook exits silently in that case.
 *
 * @param lock - Parsed lock file contents.
 * @returns Multi-line context string, or `null` if insufficient data.
 */
export function buildCompactContext(lock: LockData): string | null {
  const { ticketKey, ticketBranch } = lock;

  if (!ticketKey || !ticketBranch) return null;

  const title = lock.ticketTitle ?? '';
  const target = lock.targetBranch ?? 'main';
  const hasParent = lock.parentKey !== undefined && lock.parentKey !== 'none';

  const parentLine = hasParent ? `Parent: ${lock.parentKey}.` : undefined;
  const descriptionLine = lock.description
    ? `Requirements: ${lock.description.slice(0, MAX_DESCRIPTION_LENGTH)}`
    : undefined;

  const lines = [
    `CONTEXT RESTORED: You are implementing ticket [${ticketKey}] ${title}.`,
    `Branch: ${ticketBranch} targeting ${target}.`,
    parentLine,
    descriptionLine,
    'Continue your implementation. Do not start over.',
  ].filter(Boolean);

  return lines.join('\n');
}
