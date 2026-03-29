/**
 * Integration test: Pipeline abort scenarios.
 *
 * Tests abort paths not covered by the per-board happy-path suites:
 * - Board ping failure at preflight (per board)
 * - Feasibility check returning INFEASIBLE
 * - Lock contention (active session)
 * - Stale lock cleanup (pipeline continues)
 * - Board validation failure (unsafe env inputs)
 *
 * Uses the shared pipeline helpers with board-specific mock fetchers.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  AZDO_ENV,
  createGitHubFetcher,
  GITHUB_ENV,
  JIRA_ENV,
  LINEAR_ENV,
  NOTION_ENV,
  setupPipeline,
  SHORTCUT_ENV,
} from './pipeline-helpers.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** A fetcher that always returns 401 (auth failure). */
function createAuthFailFetcher() {
  return async (): Promise<Response> =>
    new Response('Unauthorized', { status: 401 });
}

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

// ─── Ping failure tests ──────────────────────────────────────────────────────

describe('Pipeline abort — ping failure per board', { timeout: 30_000 }, () => {
  it('aborts at preflight when GitHub ping returns 401', async () => {
    const { repo, run } = setupPipeline({
      envVars: GITHUB_ENV,
      fetcher: createAuthFailFetcher(),
    });
    cleanup = repo.cleanup;

    const result = await run();

    expect(result.status).toBe('aborted');
    expect(result.phase).toBe('preflight');
  });

  it('aborts at preflight when Jira ping returns 401', async () => {
    const { repo, run } = setupPipeline({
      envVars: JIRA_ENV,
      fetcher: createAuthFailFetcher(),
    });
    cleanup = repo.cleanup;

    const result = await run();

    expect(result.status).toBe('aborted');
    expect(result.phase).toBe('preflight');
  });

  it('aborts at preflight when Linear ping returns 401', async () => {
    const { repo, run } = setupPipeline({
      envVars: LINEAR_ENV,
      fetcher: createAuthFailFetcher(),
    });
    cleanup = repo.cleanup;

    const result = await run();

    expect(result.status).toBe('aborted');
    expect(result.phase).toBe('preflight');
  });

  it('aborts at preflight when Shortcut ping returns 401', async () => {
    const { repo, run } = setupPipeline({
      envVars: SHORTCUT_ENV,
      fetcher: createAuthFailFetcher(),
    });
    cleanup = repo.cleanup;

    const result = await run();

    expect(result.status).toBe('aborted');
    expect(result.phase).toBe('preflight');
  });

  it('aborts at preflight when Notion ping returns 401', async () => {
    const { repo, run } = setupPipeline({
      envVars: NOTION_ENV,
      fetcher: createAuthFailFetcher(),
    });
    cleanup = repo.cleanup;

    const result = await run();

    expect(result.status).toBe('aborted');
    expect(result.phase).toBe('preflight');
  });

  it('aborts at preflight when Azure DevOps ping returns 401', async () => {
    const { repo, run } = setupPipeline({
      envVars: AZDO_ENV,
      fetcher: createAuthFailFetcher(),
    });
    cleanup = repo.cleanup;

    const result = await run();

    expect(result.status).toBe('aborted');
    expect(result.phase).toBe('preflight');
  });
});

// ─── Feasibility abort tests ─────────────────────────────────────────────────

describe('Pipeline abort — feasibility check', { timeout: 30_000 }, () => {
  it('aborts at feasibility when Claude returns INFEASIBLE', async () => {
    const { repo, run } = setupPipeline({
      envVars: GITHUB_ENV,
      fetcher: createGitHubFetcher(),
      simulatorResponses: [
        { stdout: 'INFEASIBLE: requires manual database migration' },
      ],
    });
    cleanup = repo.cleanup;

    const result = await run();

    expect(result.status).toBe('aborted');
    expect(result.phase).toBe('feasibility');
  });

  it('records SKIPPED progress when feasibility fails', async () => {
    const { repo, run } = setupPipeline({
      envVars: GITHUB_ENV,
      fetcher: createGitHubFetcher(),
      simulatorResponses: [
        { stdout: 'INFEASIBLE: needs infrastructure changes' },
      ],
    });
    cleanup = repo.cleanup;

    await run();

    const progressPath = join(repo.workDir, '.clancy', 'progress.txt');
    expect(existsSync(progressPath)).toBe(true);

    const content = readFileSync(progressPath, 'utf8');
    expect(content).toContain('SKIPPED');
    expect(content).toContain('#42');
  });
});

// ─── Lock contention tests ───────────────────────────────────────────────────

describe('Pipeline abort — lock contention', { timeout: 30_000 }, () => {
  it('aborts at lock-check when active session lock exists', async () => {
    const { repo, run } = setupPipeline({
      envVars: GITHUB_ENV,
      fetcher: createGitHubFetcher(),
    });
    cleanup = repo.cleanup;

    // Pre-create lock file with current process PID (appears active)
    const clancyDir = join(repo.workDir, '.clancy');
    mkdirSync(clancyDir, { recursive: true });
    writeFileSync(
      join(clancyDir, 'lock.json'),
      JSON.stringify({
        pid: process.pid,
        ticketKey: '#99',
        ticketTitle: 'Fake ticket',
        ticketBranch: 'feature/issue-99',
        targetBranch: 'main',
        parentKey: 'none',
        startedAt: new Date().toISOString(),
      }),
    );

    const result = await run();

    expect(result.status).toBe('aborted');
    expect(result.phase).toBe('lock-check');
  });

  it('continues after cleaning up stale lock from dead process', async () => {
    const { repo, run } = setupPipeline({
      envVars: GITHUB_ENV,
      fetcher: createGitHubFetcher(),
    });
    cleanup = repo.cleanup;

    // Pre-create lock file with dead PID (stale — process doesn't exist)
    const clancyDir = join(repo.workDir, '.clancy');
    mkdirSync(clancyDir, { recursive: true });
    writeFileSync(
      join(clancyDir, 'lock.json'),
      JSON.stringify({
        pid: 999999999,
        ticketKey: '#99',
        ticketTitle: 'Stale ticket',
        ticketBranch: 'feature/issue-99',
        targetBranch: 'main',
        parentKey: 'none',
        startedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      }),
    );

    const result = await run();

    // Pipeline should clean up stale lock and continue to completion
    expect(result.status).toBe('completed');

    // Stale lock file should be cleaned up
    expect(existsSync(join(clancyDir, 'lock.json'))).toBe(false);
  });
});

// ─── Board validation failure tests ──────────────────────────────────────────

describe(
  'Pipeline abort — board validation failure',
  { timeout: 30_000 },
  () => {
    it('aborts at preflight when Jira project key has unsafe characters', async () => {
      const { repo, run } = setupPipeline({
        envVars: {
          ...JIRA_ENV,
          JIRA_PROJECT_KEY: 'PROJ"; DROP TABLE--',
        },
        fetcher: createAuthFailFetcher(),
      });
      cleanup = repo.cleanup;

      const result = await run();

      expect(result.status).toBe('aborted');
      expect(result.phase).toBe('preflight');
    });

    it('aborts at preflight when AzDo project has unsafe characters', async () => {
      const { repo, run } = setupPipeline({
        envVars: {
          ...AZDO_ENV,
          AZDO_PROJECT: 'test"; DROP TABLE--',
        },
        fetcher: createAuthFailFetcher(),
      });
      cleanup = repo.cleanup;

      const result = await run();

      expect(result.status).toBe('aborted');
      expect(result.phase).toBe('preflight');
    });

    it('aborts at preflight when Notion database ID is not a valid UUID', async () => {
      const { repo, run } = setupPipeline({
        envVars: {
          ...NOTION_ENV,
          NOTION_DATABASE_ID: 'not-a-uuid',
        },
        fetcher: createAuthFailFetcher(),
      });
      cleanup = repo.cleanup;

      const result = await run();

      expect(result.status).toBe('aborted');
      expect(result.phase).toBe('preflight');
    });
  },
);
