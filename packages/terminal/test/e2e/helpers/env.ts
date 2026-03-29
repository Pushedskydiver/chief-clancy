/**
 * E2E test credential loading.
 *
 * Loads credentials from .env.e2e (local development) or process.env (CI).
 * Exports per-board credential objects and a hasCredentials check for
 * conditional test skipping.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseEnvContent } from '@chief-clancy/core';

/**
 * Load .env.e2e if it exists, merging into process.env.
 * CI secrets take precedence — existing env vars are not overwritten.
 *
 * @param root - Repository root directory.
 */
export function loadEnvFile(
  root: string = resolve(import.meta.dirname, '../../../../..'),
): void {
  const envPath = resolve(root, '.env.e2e');

  let content: string;
  try {
    content = readFileSync(envPath, 'utf8');
  } catch {
    // File doesn't exist — expected in CI where env vars come from secrets
    return;
  }

  const parsed = parseEnvContent(content);
  for (const [key, value] of Object.entries(parsed)) {
    // Don't override existing env vars (CI secrets take precedence)
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

/** Read an env var, returning undefined if empty. */
function env(key: string): string | undefined {
  const val = process.env[key];
  return val && val.trim() ? val.trim() : undefined;
}

// ── Board types ─────────────────────────────────────────────────

export type E2EBoard =
  | 'github'
  | 'jira'
  | 'linear'
  | 'shortcut'
  | 'notion'
  | 'azdo';

type GitHubCredentials = {
  readonly token: string;
  readonly repo: string;
};

type JiraCredentials = {
  readonly baseUrl: string;
  readonly user: string;
  readonly apiToken: string;
  readonly projectKey: string;
};

type LinearCredentials = {
  readonly apiKey: string;
  readonly teamId: string;
};

type ShortcutCredentials = {
  readonly token: string;
};

type NotionCredentials = {
  readonly token: string;
  readonly databaseId: string;
};

type AzdoCredentials = {
  readonly org: string;
  readonly project: string;
  readonly pat: string;
};

// ── Credential getters ──────────────────────────────────────────

/**
 * Get GitHub credentials or undefined if not available.
 *
 * @returns GitHub credentials, or undefined.
 */
export function getGitHubCredentials(): GitHubCredentials | undefined {
  const token = env('GITHUB_TOKEN');
  const repo = env('GITHUB_REPO');
  if (!token || !repo) return undefined;
  return { token, repo };
}

/**
 * Get Jira credentials or undefined if not available.
 *
 * @returns Jira credentials, or undefined.
 */
export function getJiraCredentials(): JiraCredentials | undefined {
  const baseUrl = env('JIRA_BASE_URL');
  const user = env('JIRA_USER');
  const apiToken = env('JIRA_API_TOKEN');
  const projectKey = env('JIRA_PROJECT_KEY') ?? 'CLANCYQA';
  if (!baseUrl || !user || !apiToken) return undefined;
  return { baseUrl, user, apiToken, projectKey };
}

/**
 * Get Linear credentials or undefined if not available.
 *
 * @returns Linear credentials, or undefined.
 */
export function getLinearCredentials(): LinearCredentials | undefined {
  const apiKey = env('LINEAR_API_KEY');
  const teamId = env('LINEAR_TEAM_ID');
  if (!apiKey || !teamId) return undefined;
  return { apiKey, teamId };
}

/**
 * Get Shortcut credentials or undefined if not available.
 *
 * @returns Shortcut credentials, or undefined.
 */
export function getShortcutCredentials(): ShortcutCredentials | undefined {
  const token = env('SHORTCUT_TOKEN');
  if (!token) return undefined;
  return { token };
}

/**
 * Get Notion credentials or undefined if not available.
 *
 * @returns Notion credentials, or undefined.
 */
export function getNotionCredentials(): NotionCredentials | undefined {
  const token = env('NOTION_TOKEN');
  const databaseId = env('NOTION_DATABASE_ID');
  if (!token || !databaseId) return undefined;
  return { token, databaseId };
}

/**
 * Get Azure DevOps credentials or undefined if not available.
 *
 * @returns Azure DevOps credentials, or undefined.
 */
export function getAzdoCredentials(): AzdoCredentials | undefined {
  const org = env('AZURE_ORG');
  const project = env('AZURE_PROJECT');
  const pat = env('AZURE_PAT');
  if (!org || !project || !pat) return undefined;
  return { org, project, pat };
}

/**
 * Check whether credentials are available for a given board.
 *
 * @param board - The board to check.
 * @returns True if credentials are available.
 */
export function hasCredentials(board: E2EBoard): boolean {
  const getters: Record<E2EBoard, () => unknown> = {
    github: getGitHubCredentials,
    jira: getJiraCredentials,
    linear: getLinearCredentials,
    shortcut: getShortcutCredentials,
    notion: getNotionCredentials,
    azdo: getAzdoCredentials,
  };
  return getters[board]() !== undefined;
}
