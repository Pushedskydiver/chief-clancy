/**
 * Notion — E2E test against real Notion API + GitHub sandbox repo.
 *
 * Creates a real Notion page, runs the full pipeline with Claude
 * simulated (creates commits, no real invocation), verifies the PR
 * was created on the GitHub sandbox and the progress file was
 * updated, then cleans everything up.
 *
 * Prerequisites:
 * - .env.e2e with NOTION_TOKEN and NOTION_DATABASE_ID
 * - .env.e2e with GITHUB_TOKEN (for git push + PR creation)
 * - Sandbox Notion database with title, status, and multi_select properties
 *
 * IMPORTANT: Do NOT include GITHUB_REPO in env vars — detectBoard
 * checks GITHUB_TOKEN + GITHUB_REPO before Notion and would
 * misdetect as GitHub Issues. GITHUB_TOKEN alone is used as the
 * git host token for PR creation (via sharedEnvSchema).
 *
 * NOTE: Notion env vars require schema discovery — the status
 * option name (CLANCY_NOTION_TODO) and labels property name
 * (CLANCY_NOTION_LABELS) vary per database and must be resolved
 * at runtime via discoverNotionSchema().
 */
import type { E2EPipelineSetup } from './pipeline-e2e-setup.js';

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  cleanupBranch,
  cleanupPullRequest,
} from '../helpers/cleanup/cleanup.js';
import { cleanupNotionTicket } from '../helpers/cleanup/notion.js';
import {
  getGitHubCredentials,
  getNotionCredentials,
  hasCredentials,
  loadEnvFile,
} from '../helpers/env.js';
import { fetchWithTimeout } from '../helpers/fetch-timeout.js';
import { cleanupGitAuth, configureGitAuth } from '../helpers/git-auth.js';
import { discoverNotionSchema } from '../helpers/ticket-factory/notion.js';
import {
  createTestTicket,
  generateRunId,
} from '../helpers/ticket-factory/ticket-factory.js';
import { setupE2EPipeline } from './pipeline-e2e-setup.js';

// ── Setup ───────────────────────────────────────────────────────

loadEnvFile();

const canRun = hasCredentials('notion') && hasCredentials('github');

// ── Test suite ──────────────────────────────────────────────────

describe.skipIf(!canRun)('E2E: Notion — full pipeline', () => {
  const runId = generateRunId();
  let ticketId: string | undefined;
  let ticketKey: string | undefined;
  let ticketBranch: string | undefined;
  let prNumber: string | undefined;
  let pipeline: E2EPipelineSetup | undefined;

  beforeAll(async () => {
    const githubCreds = getGitHubCredentials()!;
    configureGitAuth(githubCreds.token);

    // Create a real test page on the Notion database
    const ticket = await createTestTicket('notion', runId);
    ticketId = ticket.id;
    ticketKey = ticket.key;
    // Notion keys are like "notion-ab12cd34" → branch is "feature/notion-ab12cd34"
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
      // Notion cleanup archives the page (no hard delete via API)
      await cleanupNotionTicket(ticketId).catch(() => {});
    }
    pipeline?.repo.cleanup();
    cleanupGitAuth();
  });

  it('creates a page, runs the pipeline, and verifies PR creation', async () => {
    const githubCreds = getGitHubCredentials()!;
    const notionCreds = getNotionCredentials()!;

    // Discover database schema — property names vary per database
    const schema = await discoverNotionSchema(
      notionCreds.token,
      notionCreds.databaseId,
    );

    // Set up pipeline with real GitHub remote + Notion credentials.
    // GITHUB_REPO is intentionally omitted — see file-level JSDoc.
    const envVars: Record<string, string> = {
      NOTION_TOKEN: notionCreds.token,
      NOTION_DATABASE_ID: notionCreds.databaseId,
      GITHUB_TOKEN: githubCreds.token,
      CLANCY_BASE_BRANCH: 'main',
      CLANCY_NOTION_TODO: schema.statusOptionName,
    };

    // Both must be set together — the pipeline needs the property name
    // to know WHERE to look and the label value to know WHAT to match
    if (schema.labelsPropName) {
      envVars.CLANCY_NOTION_LABELS = schema.labelsPropName;
      envVars.CLANCY_LABEL_BUILD = 'clancy:build';
    }

    pipeline = setupE2EPipeline({
      remoteUrl: `https://github.com/${githubCreds.repo}.git`,
      envVars,
      ticketKey: ticketKey!,
    });

    // Run the full pipeline — real Notion + GitHub API, simulated Claude
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
