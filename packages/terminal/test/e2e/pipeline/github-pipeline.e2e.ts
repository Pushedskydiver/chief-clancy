/**
 * GitHub Issues — E2E test against real GitHub API.
 *
 * Creates a real issue on the sandbox repo, runs the full pipeline
 * with Claude simulated (creates commits, no real invocation),
 * verifies the PR was created, then cleans everything up.
 *
 * Prerequisites:
 * - .env.e2e with GITHUB_TOKEN and GITHUB_REPO set
 * - Sandbox repo exists with Issues enabled
 * - clancy:build label exists on the sandbox repo
 */
import type { E2EPipelineSetup } from './pipeline-e2e-setup.js';

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { cleanupBranch } from '../helpers/cleanup/cleanup.js';
import {
  cleanupGitHubPullRequest,
  cleanupGitHubTicket,
} from '../helpers/cleanup/github.js';
import {
  getGitHubCredentials,
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

const canRun = hasCredentials('github');

// ── Test suite ──────────────────────────────────────────────────

describe.skipIf(!canRun)('E2E: GitHub — full pipeline', () => {
  const runId = generateRunId();
  let ticketId: string | undefined;
  let ticketBranch: string | undefined;
  let prNumber: string | undefined;
  let pipeline: E2EPipelineSetup | undefined;

  beforeAll(async () => {
    const creds = getGitHubCredentials()!;
    configureGitAuth(creds.token);

    // Create a real test ticket on the sandbox repo
    const ticket = await createTestTicket('github', runId);
    ticketId = ticket.id;
    ticketBranch = `feature/issue-${ticket.id}`;

    // Brief pause — GitHub Issues list API has eventual consistency
    await new Promise((r) => setTimeout(r, 2_000));
  });

  afterAll(async () => {
    // Clean up in reverse order: PR → branch → ticket → repo
    if (prNumber) {
      await cleanupGitHubPullRequest(prNumber).catch(() => {});
    }
    if (pipeline && ticketBranch) {
      cleanupBranch(pipeline.repo.workDir, ticketBranch);
    }
    if (ticketId) {
      await cleanupGitHubTicket(ticketId).catch(() => {});
    }
    pipeline?.repo.cleanup();
    cleanupGitAuth();
  });

  it('creates a ticket, runs the pipeline, and verifies PR creation', async () => {
    const creds = getGitHubCredentials()!;

    // Set up pipeline with real GitHub remote
    pipeline = setupE2EPipeline({
      remoteUrl: `https://github.com/${creds.repo}.git`,
      envVars: {
        GITHUB_TOKEN: creds.token,
        GITHUB_REPO: creds.repo,
        CLANCY_BASE_BRANCH: 'main',
        CLANCY_LABEL_BUILD: 'clancy:build',
      },
      ticketKey: `issue-${ticketId}`,
    });

    // Run the full pipeline — real GitHub API, simulated Claude
    const result = await pipeline.run();
    expect(result.status).toBe('completed');

    // Verify: feature branch was created
    const branches = pipeline.repo.exec(['branch', '--list']);
    expect(branches).toContain(ticketBranch);

    // Verify: progress.txt has entry
    const progressPath = join(pipeline.repo.workDir, '.clancy', 'progress.txt');
    expect(existsSync(progressPath)).toBe(true);

    const progress = readFileSync(progressPath, 'utf8');
    expect(progress).toContain(`#${ticketId}`);
    expect(progress).toMatch(/PR_CREATED|PUSHED/);

    // Extract PR number from progress
    const prMatch = progress.match(/pr:(\d+)/);
    expect(prMatch).not.toBeNull();
    prNumber = prMatch![1];

    // Verify via real GitHub API: PR exists on sandbox repo
    const prResponse = await fetchWithTimeout(
      `https://api.github.com/repos/${creds.repo}/pulls/${prNumber}`,
      {
        headers: {
          Authorization: `Bearer ${creds.token}`,
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
    expect(prData.body).toContain(`#${ticketId}`);

    // Verify via real GitHub API: issue is still open
    // (GitHub doesn't close until PR is merged)
    const issueResponse = await fetchWithTimeout(
      `https://api.github.com/repos/${creds.repo}/issues/${ticketId}`,
      {
        headers: {
          Authorization: `Bearer ${creds.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );
    expect(issueResponse.ok).toBe(true);

    const issueData = (await issueResponse.json()) as { state: string };
    expect(issueData.state).toBe('open');
  });
});
