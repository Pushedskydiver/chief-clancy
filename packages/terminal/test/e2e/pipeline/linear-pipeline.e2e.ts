/**
 * Linear — E2E test against real Linear GraphQL API + GitHub sandbox repo.
 *
 * Creates a real Linear issue, runs the full pipeline with Claude
 * simulated (creates commits, no real invocation), verifies the PR
 * was created on the GitHub sandbox and the progress file was
 * updated, then cleans everything up.
 *
 * Prerequisites:
 * - .env.e2e with LINEAR_API_KEY and LINEAR_TEAM_ID
 * - .env.e2e with GITHUB_TOKEN (for git push + PR creation)
 * - Linear team exists with an "unstarted" workflow state
 * - clancy:build label exists (or will be auto-created) on the Linear team
 *
 * IMPORTANT: Do NOT include GITHUB_REPO in env vars — detectBoard
 * checks GITHUB_TOKEN + GITHUB_REPO before Linear and would
 * misdetect as GitHub Issues. GITHUB_TOKEN alone is used as the
 * git host token for PR creation (via sharedEnvSchema).
 */
import type { E2EPipelineSetup } from './pipeline-e2e-setup.js';

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  cleanupBranch,
  cleanupPullRequest,
} from '../helpers/cleanup/cleanup.js';
import { cleanupLinearTicket } from '../helpers/cleanup/linear.js';
import {
  getGitHubCredentials,
  getLinearCredentials,
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

const canRun = hasCredentials('linear') && hasCredentials('github');

// ── Test suite ──────────────────────────────────────────────────

describe.skipIf(!canRun)('E2E: Linear — full pipeline', () => {
  const runId = generateRunId();
  let ticketId: string | undefined;
  let ticketKey: string | undefined;
  let ticketBranch: string | undefined;
  let prNumber: string | undefined;
  let pipeline: E2EPipelineSetup | undefined;

  beforeAll(async () => {
    const githubCreds = getGitHubCredentials()!;
    configureGitAuth(githubCreds.token);

    // Create a real test ticket on the Linear team
    const ticket = await createTestTicket('linear', runId);
    ticketId = ticket.id;
    ticketKey = ticket.key;
    // Linear keys are like "CLA-5" → branch is "feature/cla-5"
    ticketBranch = `feature/${ticket.key.toLowerCase()}`;
  });

  afterAll(async () => {
    // Clean up in reverse order: PR → branch → ticket → repo
    if (prNumber) {
      await cleanupPullRequest(prNumber).catch(() => {});
    }
    if (pipeline && ticketBranch) {
      cleanupBranch(pipeline.repo.workDir, ticketBranch);
    }
    if (ticketId) {
      // Linear cleanup takes the UUID, not the key
      await cleanupLinearTicket(ticketId).catch(() => {});
    }
    pipeline?.repo.cleanup();
    cleanupGitAuth();
  });

  it('creates a ticket, runs the pipeline, and verifies PR creation', async () => {
    const githubCreds = getGitHubCredentials()!;
    const linearCreds = getLinearCredentials()!;

    // Set up pipeline with real GitHub remote + Linear credentials.
    // GITHUB_REPO is intentionally omitted — see file-level JSDoc.
    pipeline = setupE2EPipeline({
      remoteUrl: `https://github.com/${githubCreds.repo}.git`,
      envVars: {
        LINEAR_API_KEY: linearCreds.apiKey,
        LINEAR_TEAM_ID: linearCreds.teamId,
        GITHUB_TOKEN: githubCreds.token,
        CLANCY_BASE_BRANCH: 'main',
        CLANCY_LABEL_BUILD: 'clancy:build',
      },
      ticketKey: ticketKey!,
    });

    // Run the full pipeline — real Linear + GitHub API, simulated Claude
    const result = await pipeline.run();
    expect(result.status).toBe('completed');

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
    expect(prMatch).not.toBeNull();
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
    };
    expect(prData.state).toBe('open');
    expect(prData.head.ref).toBe(ticketBranch);
    expect(prData.base.ref).toBe('main');
  });
});
