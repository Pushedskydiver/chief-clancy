/**
 * E2E cleanup helpers — closes tickets, deletes branches and PRs.
 *
 * Cleanup runs in afterAll / try-finally to ensure resources are
 * released even when tests fail.
 */
import type { E2EBoard } from '../env.js';

import { execFileSync } from 'node:child_process';

import { cleanupAzdoTicket } from './azdo.js';
import { cleanupGitHubPullRequest, cleanupGitHubTicket } from './github.js';
import { cleanupJiraTicket } from './jira.js';
import { cleanupLinearTicket } from './linear.js';
import { cleanupNotionTicket } from './notion.js';
import { cleanupShortcutTicket } from './shortcut.js';

/**
 * Clean up a test ticket by closing or deleting it.
 *
 * @param board - The board the ticket was created on.
 * @param ticketId - The board-specific ticket ID.
 */
export async function cleanupTicket(
  board: E2EBoard,
  ticketId: string,
): Promise<void> {
  const cleaners: Record<E2EBoard, (id: string) => Promise<void>> = {
    github: cleanupGitHubTicket,
    jira: cleanupJiraTicket,
    linear: cleanupLinearTicket,
    shortcut: cleanupShortcutTicket,
    notion: cleanupNotionTicket,
    azdo: cleanupAzdoTicket,
  };
  return cleaners[board](ticketId);
}

/**
 * Close a pull request on the sandbox repo.
 *
 * All boards use the same GitHub sandbox repo for PRs.
 *
 * @param prNumber - The PR number to close.
 */
export async function cleanupPullRequest(prNumber: string): Promise<void> {
  return cleanupGitHubPullRequest(prNumber);
}

/**
 * Delete a remote branch from the sandbox repo.
 *
 * Silently succeeds if the branch does not exist on the remote.
 *
 * @param repoPath - Local repo path (cwd for git).
 * @param branchName - The branch name to delete.
 */
export function cleanupBranch(repoPath: string, branchName: string): void {
  try {
    execFileSync('git', ['push', 'origin', '--delete', branchName], {
      cwd: repoPath,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    // Branch may not exist on remote — that's fine
  }
}
