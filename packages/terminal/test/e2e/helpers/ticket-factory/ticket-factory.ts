/**
 * E2E ticket factory — creates real tickets on board platforms.
 *
 * Each board has a createTestTicket implementation that calls the real API.
 * Ticket titles include a unique run ID for isolation between concurrent runs.
 */
import { createAzdoTicket } from './azdo.js';
import { createGitHubTicket } from './github.js';
import { createJiraTicket } from './jira.js';
import { createLinearTicket } from './linear.js';
import { createNotionTicket } from './notion.js';
import { createShortcutTicket } from './shortcut.js';

// Export when consumed by cleanup helpers / GC (12.4+)
type E2EBoard = 'github' | 'jira' | 'linear' | 'shortcut' | 'notion' | 'azdo';

export type CreateTicketOptions = {
  /** Override the default ticket title suffix. */
  readonly titleSuffix?: string;
};

export type CreatedTicket = {
  /** Board-specific ticket ID (e.g. issue number for GitHub). */
  readonly id: string;
  /** Board-specific ticket key (e.g. '#42' for GitHub). */
  readonly key: string;
  /** URL to the ticket on the board platform. */
  readonly url: string;
};

/** Generate a unique run ID for test isolation. */
export function generateRunId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build a standard E2E test ticket title.
 *
 * @param board - The board name.
 * @param runId - The unique run ID.
 * @param titleSuffix - Optional suffix.
 * @returns The formatted title.
 */
export function buildTitle(
  board: string,
  runId: string,
  titleSuffix?: string,
): string {
  const base = `[QA] E2E test — ${board} — ${runId}`;
  return titleSuffix ? `${base} — ${titleSuffix}` : base;
}

/**
 * Create a test ticket on a real board platform.
 *
 * The ticket title includes `[QA]`, the board name, and a unique run ID
 * so orphan GC can identify and clean up test tickets.
 *
 * @param board - The board to create the ticket on.
 * @param runId - The unique run ID for test isolation.
 * @param options - Optional ticket creation options.
 * @returns The created ticket.
 */
export async function createTestTicket(
  board: E2EBoard,
  runId: string,
  options: CreateTicketOptions = {},
): Promise<CreatedTicket> {
  const creators: Record<
    E2EBoard,
    (r: string, o: CreateTicketOptions) => Promise<CreatedTicket>
  > = {
    github: createGitHubTicket,
    jira: createJiraTicket,
    linear: createLinearTicket,
    shortcut: createShortcutTicket,
    notion: createNotionTicket,
    azdo: createAzdoTicket,
  };
  return creators[board](runId, options);
}
