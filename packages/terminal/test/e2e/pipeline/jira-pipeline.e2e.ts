/**
 * Jira — E2E test against real Jira API + GitHub sandbox repo.
 *
 * Creates a real Jira issue, runs the full pipeline with Claude
 * simulated (creates commits, no real invocation), verifies the PR
 * was created on the GitHub sandbox and the progress file was
 * updated, then cleans everything up.
 *
 * Prerequisites:
 * - .env.e2e with JIRA_BASE_URL, JIRA_USER, JIRA_API_TOKEN, JIRA_PROJECT_KEY
 * - .env.e2e with GITHUB_TOKEN and GITHUB_REPO (for git push + PR creation)
 * - Sandbox Jira project exists with a "Done" transition
 * - clancy-build label exists on the Jira project
 */
import type { E2EPipelineSetup } from './pipeline-e2e-setup.js';

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  cleanupBranch,
  cleanupPullRequest,
} from '../helpers/cleanup/cleanup.js';
import { cleanupJiraTicket } from '../helpers/cleanup/jira.js';
import {
  getGitHubCredentials,
  getJiraCredentials,
  hasCredentials,
  loadEnvFile,
} from '../helpers/env.js';
import { fetchWithTimeout } from '../helpers/fetch-timeout.js';
import { cleanupGitAuth, configureGitAuth } from '../helpers/git-auth.js';
import {
  createTestTicket,
  generateRunId,
} from '../helpers/ticket-factory/ticket-factory.js';
import { setupE2EPipeline } from './pipeline-e2e-setup.js';

// ── Setup ───────────────────────────────────────────────────────

loadEnvFile();

const canRun = hasCredentials('jira') && hasCredentials('github');

// ── Test suite ──────────────────────────────────────────────────

describe.skipIf(!canRun)('E2E: Jira — full pipeline', () => {
  const runId = generateRunId();
  let ticketKey: string | undefined;
  let ticketBranch: string | undefined;
  let prNumber: string | undefined;
  let pipeline: E2EPipelineSetup | undefined;

  beforeAll(async () => {
    const githubCreds = getGitHubCredentials()!;
    configureGitAuth(githubCreds.token);

    // Create a real test ticket on the sandbox Jira project
    const ticket = await createTestTicket('jira', runId);
    ticketKey = ticket.key;
    ticketBranch = `feature/${ticket.key.toLowerCase()}`;

    // No consistency pause needed — Jira issue API is strongly consistent
    // (unlike GitHub Issues list API which has eventual consistency)
  });

  afterAll(async () => {
    // Clean up in reverse order: PR → branch → ticket → repo
    if (prNumber) {
      await cleanupPullRequest(prNumber).catch(() => {});
    }
    if (pipeline && ticketBranch) {
      cleanupBranch(pipeline.repo.workDir, ticketBranch);
    }
    if (ticketKey) {
      await cleanupJiraTicket(ticketKey).catch(() => {});
    }
    pipeline?.repo.cleanup();
    cleanupGitAuth();
  });

  it('creates a ticket, runs the pipeline, and verifies PR creation', async () => {
    const githubCreds = getGitHubCredentials()!;
    const jiraCreds = getJiraCredentials()!;

    // Set up pipeline with real GitHub remote + Jira credentials
    pipeline = setupE2EPipeline({
      remoteUrl: `https://github.com/${githubCreds.repo}.git`,
      envVars: {
        JIRA_BASE_URL: jiraCreds.baseUrl,
        JIRA_USER: jiraCreds.user,
        JIRA_API_TOKEN: jiraCreds.apiToken,
        JIRA_PROJECT_KEY: jiraCreds.projectKey,
        GITHUB_TOKEN: githubCreds.token,
        GITHUB_REPO: githubCreds.repo,
        CLANCY_BASE_BRANCH: 'main',
        CLANCY_LABEL_BUILD: 'clancy-build',
      },
      ticketKey: ticketKey!,
    });

    // Run the full pipeline — real Jira + GitHub API, simulated Claude
    const result = await pipeline.run();
    expect(
      result.status,
      `Pipeline failed at phase "${result.phase}": ${result.error}`,
    ).toBe('completed');

    // Verify: feature branch was created
    const branches = pipeline.repo.exec(['branch', '--list']);
    expect(branches).toContain(ticketBranch);

    // Verify: progress.txt has entry
    const progressPath = join(pipeline.repo.workDir, '.clancy', 'progress.txt');
    expect(existsSync(progressPath)).toBe(true);

    const progress = readFileSync(progressPath, 'utf8');
    expect(progress).toContain(ticketKey);
    expect(progress).toMatch(/PR_CREATED|PUSHED/);

    // Extract PR number from progress
    const prMatch = progress.match(/pr:(\d+)/);
    expect(prMatch, `No pr:<number> in progress:\n${progress}`).not.toBeNull();
    prNumber = prMatch![1];

    // Verify via real GitHub API: PR exists on sandbox repo
    const prResponse = await fetchWithTimeout(
      `https://api.github.com/repos/${githubCreds.repo}/pulls/${prNumber}`,
      {
        headers: {
          Authorization: `Bearer ${githubCreds.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );
    expect(prResponse.ok).toBe(true);

    const prData = (await prResponse.json()) as {
      state: string;
      head: { ref: string };
      base: { ref: string };
      body: string;
    };
    expect(prData.state).toBe('open');
    expect(prData.head.ref).toBe(ticketBranch);
    expect(prData.base.ref).toBe('main');
    expect(prData.body).toContain(ticketKey);
  });
});
