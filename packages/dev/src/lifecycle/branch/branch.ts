/**
 * Branch name computation for ticket workflows.
 *
 * Pure functions that compute feature and target branch names
 * based on the board provider and ticket metadata.
 */
import type { BoardProvider } from '@chief-clancy/core/types/index.js';

/**
 * Compute the feature branch name for a ticket.
 *
 * - GitHub: `feature/issue-{number}` (e.g., `feature/issue-42`)
 * - All others: `feature/{key-lowercase}` (e.g., `feature/proj-123`)
 *
 * @param provider - The board provider.
 * @param key - The ticket key (e.g., `'PROJ-123'`, `'#42'`, `'ENG-123'`).
 * @returns The feature branch name.
 */
export function computeTicketBranch(
  provider: BoardProvider,
  key: string,
): string {
  if (provider === 'github') {
    const number = key.replace('#', '');
    return `feature/issue-${number}`;
  }

  return `feature/${key.toLowerCase()}`;
}

/**
 * Compute the target branch for merging.
 *
 * If the ticket has a parent (epic/milestone), branches from that parent's
 * branch. Otherwise falls back to the base branch.
 *
 * - GitHub issue ref (`#N`): `epic/{number}`
 * - GitHub milestone title: `milestone/{slug}`
 * - All others: `epic/{key-lowercase}`
 *
 * @param provider - The board provider.
 * @param baseBranch - The default base branch (e.g., `'main'`).
 * @param parent - Optional parent identifier (epic key, milestone title, parent ID).
 * @returns The target branch name.
 */
export function computeTargetBranch(
  provider: BoardProvider,
  baseBranch: string,
  parent?: string,
): string {
  if (!parent) return baseBranch;

  if (provider === 'github') {
    const issueRefMatch = parent.match(/^#(\d+)$/);
    if (issueRefMatch) return `epic/${issueRefMatch[1]}`;

    const slug = parent
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    return `milestone/${slug}`;
  }

  return `epic/${parent.toLowerCase()}`;
}
