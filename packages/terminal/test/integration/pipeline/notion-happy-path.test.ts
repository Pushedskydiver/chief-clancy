/**
 * Integration test: Notion board — full pipeline happy path.
 *
 * Exercises the complete 13-phase pipeline with:
 * - Real git operations (temp repo with bare remote)
 * - DI fetcher returning canned Notion API responses
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

import { jsonResponse, NOTION_ENV, setupPipeline } from './pipeline-helpers.js';

// ─── Notion API mock fetcher ────────────────────────────────────────────────

/** Full UUID for the test page. Short key: notion-ab12cd34. */
const PAGE_UUID = 'ab12cd34-5678-9abc-def0-123456789abc';

const NOTION_PAGE = {
  id: PAGE_UUID,
  properties: {
    Name: {
      type: 'title',
      title: [{ plain_text: 'Add widget feature' }],
    },
    Description: {
      type: 'rich_text',
      rich_text: [
        { plain_text: 'Implement the widget.\n\nEpic: notion-ff001122' },
      ],
    },
    Status: {
      type: 'status',
      status: { name: 'To-do' },
    },
    Labels: {
      type: 'multi_select',
      multi_select: [{ name: 'clancy' }],
    },
    Epic: {
      type: 'relation',
      relation: [{ id: 'ff001122-3344-5566-7788-99aabbccddee' }],
    },
  },
};

/** Route definitions for the Notion mock fetcher. */
const ROUTES: ReadonlyArray<{
  readonly method: string;
  readonly pattern: RegExp;
  readonly respond: (url: string, init?: RequestInit) => Response;
}> = [
  // Ping: GET /users/me
  {
    method: 'GET',
    pattern: /\/users\/me$/,
    respond: () => jsonResponse({ id: 'user-uuid', type: 'bot' }),
  },
  // Query database: POST /databases/{id}/query
  {
    method: 'POST',
    pattern: /\/databases\/[^/]+\/query$/,
    respond: () =>
      jsonResponse({
        results: [NOTION_PAGE],
        has_more: false,
        next_cursor: null,
      }),
  },
  // Fetch page: GET /pages/{id}
  {
    method: 'GET',
    pattern: /\/pages\/[^/]+$/,
    respond: () => jsonResponse(NOTION_PAGE),
  },
  // Update page: PATCH /pages/{id}
  {
    method: 'PATCH',
    pattern: /\/pages\/[^/]+$/,
    respond: () => jsonResponse({ id: PAGE_UUID }),
  },
];

function createNotionFetcher() {
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

// ─── Shared test setup ───────────────────────────────────────────────────────

function setup(overrides?: {
  readonly exitCode?: number;
  readonly fetcher?: (url: string, init?: RequestInit) => Promise<Response>;
}): PipelineSetup {
  return setupPipeline({
    envVars: NOTION_ENV,
    fetcher: overrides?.fetcher ?? createNotionFetcher(),
    exitCode: overrides?.exitCode,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe('Notion pipeline — happy path', { timeout: 30_000 }, () => {
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

    // Notion page ab12cd34-... → branch feature/notion-ab12cd34
    const branches = repo.exec(['branch', '--list']).trim();
    expect(branches).toContain('feature/notion-ab12cd34');
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
    expect(content).toContain('notion-ab12cd34');
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

  it('aborts at ticket-fetch when board returns no pages', async () => {
    const baseFetcher = createNotionFetcher();
    const emptyFetcher = async (url: string, init?: RequestInit) => {
      if (/\/databases\/[^/]+\/query$/.test(url) && init?.method === 'POST') {
        return jsonResponse({
          results: [],
          has_more: false,
          next_cursor: null,
        });
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
