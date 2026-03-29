/**
 * Orphan ticket garbage collector for E2E tests.
 *
 * Queries each board for tickets with [QA] in the title older than
 * 24 hours and cleans them up (close/delete). Also cleans up orphaned
 * PRs and branches on the sandbox repo.
 *
 * Handles cases where afterAll never runs: CI killed, OOM, timeout,
 * manual cancellation.
 *
 * Usage: npx tsx test/e2e/helpers/gc/gc.ts
 */
import type { E2EBoard } from '../env.js';

import { cleanupAzdoOrphans } from './azdo.js';
import { cleanupGitHubOrphans } from './github.js';
import { cleanupJiraOrphans } from './jira.js';
import { cleanupLinearOrphans } from './linear.js';
import { cleanupNotionOrphans } from './notion.js';
import { cleanupShortcutOrphans } from './shortcut.js';

/**
 * Clean up orphan test tickets for a given board.
 *
 * @param board - The board to clean up.
 * @returns Number of orphan resources cleaned.
 */
export async function cleanupOrphanTickets(board: E2EBoard): Promise<number> {
  const cleaners: Record<E2EBoard, () => Promise<number>> = {
    github: cleanupGitHubOrphans,
    jira: cleanupJiraOrphans,
    linear: cleanupLinearOrphans,
    shortcut: cleanupShortcutOrphans,
    notion: cleanupNotionOrphans,
    azdo: cleanupAzdoOrphans,
  };
  return cleaners[board]();
}

// ── CLI entry point ────────────────────────────────────────────

const isDirectRun = [process.argv[1], process.argv[2]].some(
  (arg) => arg?.endsWith('gc.ts') || arg?.endsWith('gc.js'),
);

if (isDirectRun) {
  const boards: ReadonlyArray<E2EBoard> = [
    'github',
    'jira',
    'linear',
    'shortcut',
    'notion',
    'azdo',
  ];

  console.log('Clancy E2E — Orphan Ticket Garbage Collector\n');

  let totalCleaned = 0;

  for (const board of boards) {
    console.log(`${board}:`);
    const count = await cleanupOrphanTickets(board);
    totalCleaned += count;
    if (count === 0) console.log('  No orphans found');
  }

  console.log(`\nDone — cleaned ${totalCleaned} orphan(s)`);
}
