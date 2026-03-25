/**
 * Resolve the conventional commit type for a ticket.
 *
 * Maps board-specific ticket types (e.g., Shortcut `story_type`,
 * Jira `issuetype`, Azure DevOps `WorkItemType`) to conventional
 * commit prefixes (`feat`, `fix`, `chore`). Falls back to `feat`
 * when the ticket type is unknown or not provided.
 */

/** Known commit types for PR titles. */
type CommitType = 'feat' | 'fix' | 'chore';

/**
 * Keywords that map to `fix` — matched case-insensitively against
 * the raw ticket type string.
 */
const FIX_KEYWORDS = ['bug', 'bugfix', 'defect', 'hotfix', 'incident'];

/**
 * Keywords that map to `chore` — matched case-insensitively.
 */
const CHORE_KEYWORDS = [
  'chore',
  'task',
  'maintenance',
  'spike',
  'tech debt',
  'infrastructure',
];

/**
 * Resolve a conventional commit type from a board ticket type string.
 *
 * Matches against known keywords case-insensitively. Returns `'feat'`
 * when the ticket type is `undefined`, empty, or unrecognised.
 *
 * @param ticketType - The raw ticket type from the board (e.g., `'Bug'`, `'feature'`, `'Task'`).
 * @returns The conventional commit type.
 */
export function resolveCommitType(ticketType: string | undefined): CommitType {
  if (!ticketType) return 'feat';

  const lower = ticketType.toLowerCase().trim();
  if (!lower) return 'feat';

  if (FIX_KEYWORDS.some((kw) => lower.includes(kw))) return 'fix';
  if (CHORE_KEYWORDS.some((kw) => lower.includes(kw))) return 'chore';

  return 'feat';
}
