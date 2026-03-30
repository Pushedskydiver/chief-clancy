/**
 * Azure DevOps — E2E test against real AzDO API + GitHub sandbox repo.
 *
 * Creates a real AzDO work item, runs the full pipeline with Claude
 * simulated (creates commits, no real invocation), verifies the PR
 * was created on the GitHub sandbox and the progress file was
 * updated, then cleans everything up.
 *
 * Prerequisites:
 * - .env.e2e with AZURE_ORG, AZURE_PROJECT, AZURE_PAT
 * - .env.e2e with GITHUB_TOKEN (for git push + PR creation)
 * - Azure DevOps project exists with a "New" work item state
 *
 * IMPORTANT: Do NOT include GITHUB_REPO in env vars — detectBoard
 * checks GITHUB_TOKEN + GITHUB_REPO before Azure DevOps and would
 * misdetect as GitHub Issues. GITHUB_TOKEN alone is used as the
 * git host token for PR creation (via sharedEnvSchema).
 *
 * NOTE: The env var name difference — .env.e2e uses AZURE_ORG,
 * AZURE_PROJECT, AZURE_PAT but the runtime schema expects AZDO_ORG,
 * AZDO_PROJECT, AZDO_PAT. The credential loader reads the former;
 * setupE2EPipeline writes the latter.
 */
import type { E2EPipelineSetup } from './pipeline-e2e-setup.js';

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { cleanupAzdoTicket } from '../helpers/cleanup/azdo.js';
import {
  cleanupBranch,
  cleanupPullRequest,
} from '../helpers/cleanup/cleanup.js';
import {
  getAzdoCredentials,
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

const canRun = hasCredentials('azdo') && hasCredentials('github');

// ── Test suite ──────────────────────────────────────────────────

describe.skipIf(!canRun)('E2E: Azure DevOps — full pipeline', () => {
  const runId = generateRunId();
  let ticketId: string | undefined;
  let ticketKey: string | undefined;
  let ticketBranch: string | undefined;
  let prNumber: string | undefined;
  let pipeline: E2EPipelineSetup | undefined;

  beforeAll(async () => {
    const githubCreds = getGitHubCredentials()!;
    configureGitAuth(githubCreds.token);

    // Create a real work item on the Azure DevOps project
    const ticket = await createTestTicket('azdo', runId);
    ticketId = ticket.id;
    ticketKey = ticket.key;
    // AzDO keys are like "azdo-123" → branch is "feature/azdo-123"
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
      // AzDO cleanup tries hard delete, falls back to close + tag
      await cleanupAzdoTicket(ticketId).catch(() => {});
    }
    pipeline?.repo.cleanup();
    cleanupGitAuth();
  });

  it('creates a work item, runs the pipeline, and verifies PR creation', async () => {
    const githubCreds = getGitHubCredentials()!;
    const azdoCreds = getAzdoCredentials()!;

    // Set up pipeline with real GitHub remote + AzDO credentials.
    // GITHUB_REPO is intentionally omitted — see file-level JSDoc.
    // AZDO_* env vars are the runtime names (not AZURE_* from .env.e2e).
    pipeline = setupE2EPipeline({
      remoteUrl: `https://github.com/${githubCreds.repo}.git`,
      envVars: {
        AZDO_ORG: azdoCreds.org,
        AZDO_PROJECT: azdoCreds.project,
        AZDO_PAT: azdoCreds.pat,
        GITHUB_TOKEN: githubCreds.token,
        CLANCY_BASE_BRANCH: 'main',
        CLANCY_LABEL_BUILD: 'clancy:build',
        // AzDO QA project uses "To Do" as the initial state (not "New")
        CLANCY_AZDO_STATUS: 'To Do',
      },
      ticketKey: ticketKey!,
    });

    // Run the full pipeline — real AzDO + GitHub API, simulated Claude
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
