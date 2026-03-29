/**
 * Integration test: Jira board — full pipeline happy path.
 *
 * Exercises the complete 13-phase pipeline with:
 * - Real git operations (temp repo with bare remote)
 * - DI fetcher returning canned Jira API responses
 * - Claude simulator for the invoke phase
 * - Real filesystem for lock/progress/cost/quality files
 *
 * Validates that the pipeline completes end-to-end and produces
 * the expected side effects (branches, lock cleanup, progress entries).
 */
import type { PipelineSetup } from './pipeline-helpers.js';

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { jsonResponse, setupPipeline } from './pipeline-helpers.js';

// ─── Jira API mock fetcher ──────────────────────────────────────────────────

const JIRA_ISSUE = {
  key: 'PROJ-42',
  fields: {
    summary: 'Add widget feature',
    description: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Implement the widget.' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Epic: PROJ-100' }],
        },
      ],
    },
    issuelinks: [],
    parent: { key: 'PROJ-100' },
    customfield_10014: null,
    labels: ['clancy'],
  },
};

/** Route definitions for the Jira mock fetcher. */
const ROUTES: ReadonlyArray<{
  readonly method: string;
  readonly pattern: RegExp;
  readonly respond: (url: string, init?: RequestInit) => Response;
}> = [
  // Ping: GET /rest/api/3/project/{projectKey}
  {
    method: 'GET',
    pattern: /\/rest\/api\/3\/project\/[^/]+$/,
    respond: () => jsonResponse({ id: '10000', key: 'PROJ' }),
  },
  // Fetch tickets: POST /rest/api/3/search/jql
  {
    method: 'POST',
    pattern: /\/rest\/api\/3\/search\/jql$/,
    respond: (_url, init) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        readonly maxResults?: number;
      };
      // Children status queries use maxResults: 0
      if (body.maxResults === 0) {
        return jsonResponse({ total: 0, issues: [] });
      }
      return jsonResponse({ total: 1, issues: [JIRA_ISSUE] });
    },
  },
  // Transitions lookup: GET /rest/api/3/issue/{key}/transitions
  {
    method: 'GET',
    pattern: /\/rest\/api\/3\/issue\/[^/]+\/transitions$/,
    respond: () =>
      jsonResponse({
        transitions: [
          { id: '21', name: 'In Progress' },
          { id: '31', name: 'Done' },
        ],
      }),
  },
  // Transition: POST /rest/api/3/issue/{key}/transitions
  {
    method: 'POST',
    pattern: /\/rest\/api\/3\/issue\/[^/]+\/transitions$/,
    respond: () => new Response(null, { status: 204 }),
  },
  // Fetch labels: GET /rest/api/3/issue/{key}?fields=labels
  {
    method: 'GET',
    pattern: /\/rest\/api\/3\/issue\/[^/?]+\?fields=labels$/,
    respond: () => jsonResponse({ fields: { labels: ['clancy'] } }),
  },
  // Write labels: PUT /rest/api/3/issue/{key}
  {
    method: 'PUT',
    pattern: /\/rest\/api\/3\/issue\/[^/?]+$/,
    respond: () => new Response(null, { status: 204 }),
  },
  // Fetch issue links (blockers): GET /rest/api/3/issue/{key}?fields=issuelinks
  {
    method: 'GET',
    pattern: /\/rest\/api\/3\/issue\/[^/?]+\?fields=issuelinks$/,
    respond: () => jsonResponse({ fields: { issuelinks: [] } }),
  },
];

function createJiraFetcher() {
  return async (url: string, init?: RequestInit): Promise<Response> => {
    const method = init?.method ?? 'GET';
    const match = ROUTES.find(
      (r) => r.method === method && r.pattern.test(url),
    );
    return (
      match?.respond(url, init) ?? new Response('Not Found', { status: 404 })
    );
  };
}

// ─── Shared env vars ─────────────────────────────────────────────────────────

const JIRA_ENV = {
  JIRA_BASE_URL: 'https://test.atlassian.net',
  JIRA_USER: 'test@example.com',
  JIRA_API_TOKEN: 'test-api-token',
  JIRA_PROJECT_KEY: 'PROJ',
  CLANCY_LABEL: 'clancy',
};

// ─── Shared test setup ───────────────────────────────────────────────────────

function setup(overrides?: {
  readonly exitCode?: number;
  readonly fetcher?: (url: string, init?: RequestInit) => Promise<Response>;
}): PipelineSetup {
  return setupPipeline({
    envVars: JIRA_ENV,
    fetcher: overrides?.fetcher ?? createJiraFetcher(),
    exitCode: overrides?.exitCode,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe('Jira pipeline — happy path', { timeout: 30_000 }, () => {
  it('completes the full 13-phase pipeline', async () => {
    const { repo, run } = setup();
    cleanup = repo.cleanup;

    const result = await run();

    expect(result.status).toBe('completed');
  });

  it('creates a ticket branch during branch setup', async () => {
    const { repo, run } = setup();
    cleanup = repo.cleanup;

    await run();

    // Jira PROJ-42 → branch feature/proj-42
    const branches = repo.exec(['branch', '--list']).trim();
    expect(branches).toContain('feature/proj-42');
  });

  it('cleans up lock file after completion', async () => {
    const { repo, run } = setup();
    cleanup = repo.cleanup;

    await run();

    const lockPath = join(repo.workDir, '.clancy', 'lock.json');
    expect(existsSync(lockPath)).toBe(false);
  });

  it('appends progress entry on completion', async () => {
    const { repo, run } = setup();
    cleanup = repo.cleanup;

    await run();

    const progressPath = join(repo.workDir, '.clancy', 'progress.txt');
    expect(existsSync(progressPath)).toBe(true);

    const content = readFileSync(progressPath, 'utf8');
    expect(content).toContain('PROJ-42');
  });

  it('returns dry-run status with --dry-run flag', async () => {
    const { repo, run } = setup();
    cleanup = repo.cleanup;

    const result = await run(['--dry-run']);

    expect(result.status).toBe('dry-run');
  });

  it('aborts at preflight when env is missing', async () => {
    const { repo, run } = setup();
    cleanup = repo.cleanup;

    rmSync(join(repo.workDir, '.clancy', '.env'));

    const result = await run();

    expect(result.status).toBe('aborted');
    expect(result.phase).toBe('preflight');
  });

  it('aborts at ticket-fetch when board returns no issues', async () => {
    const baseFetcher = createJiraFetcher();
    const emptyFetcher = async (url: string, init?: RequestInit) => {
      if (/\/search\/jql$/.test(url) && init?.method === 'POST') {
        return jsonResponse({ total: 0, issues: [] });
      }
      return baseFetcher(url, init);
    };

    const { repo, run } = setup({ fetcher: emptyFetcher });
    cleanup = repo.cleanup;

    const result = await run();

    expect(result.status).toBe('aborted');
    expect(result.phase).toBe('ticket-fetch');
  });

  it('aborts at invoke when Claude exits non-zero', async () => {
    const { repo, run } = setup({ exitCode: 1 });
    cleanup = repo.cleanup;

    const result = await run();

    expect(result.status).toBe('aborted');
    expect(result.phase).toBe('invoke');
  });
});
