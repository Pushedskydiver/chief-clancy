/**
 * Integration test: Azure DevOps board — full pipeline happy path.
 *
 * Exercises the complete 13-phase pipeline with:
 * - Real git operations (temp repo with bare remote)
 * - DI fetcher returning canned Azure DevOps API responses
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

// ─── Azure DevOps API mock fetcher ──────────────────────────────────────────

const AZDO_WORK_ITEM = {
  id: 42,
  fields: {
    'System.Title': 'Add widget feature',
    'System.Description': 'Implement the widget.\n\nEpic: azdo-100',
    'System.State': 'New',
    'System.Tags': 'clancy',
  },
  relations: [
    {
      rel: 'System.LinkTypes.Hierarchy-Reverse',
      url: 'https://dev.azure.com/test-org/test-project/_apis/wit/workItems/100',
    },
  ],
};

/** Route definitions for the Azure DevOps mock fetcher. */
const ROUTES: ReadonlyArray<{
  readonly method: string;
  readonly pattern: RegExp;
  readonly respond: (url: string, init?: RequestInit) => Response;
}> = [
  // Ping: GET /{org}/_apis/projects/{project}
  {
    method: 'GET',
    pattern: /\/_apis\/projects\/[^?]+/,
    respond: () => jsonResponse({ id: 'project-uuid', name: 'test-project' }),
  },
  // WIQL query: POST /wit/wiql
  {
    method: 'POST',
    pattern: /\/wit\/wiql\?/,
    respond: (_url, init) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        readonly query?: string;
      };
      const query = body.query ?? '';

      // Children status queries search by description or link type
      if (query.includes('Epic:') || query.includes('WorkItemLinks')) {
        return jsonResponse({ workItems: [] });
      }

      return jsonResponse({ workItems: [{ id: 42 }] });
    },
  },
  // Fetch single work item: GET /wit/workitems/{id}?$expand=relations
  {
    method: 'GET',
    pattern: /\/wit\/workitems\/\d+\?.*\$expand=relations/,
    respond: () => jsonResponse(AZDO_WORK_ITEM),
  },
  // Batch fetch work items: GET /wit/workitems?ids=...
  {
    method: 'GET',
    pattern: /\/wit\/workitems\?ids=/,
    respond: () => jsonResponse({ value: [AZDO_WORK_ITEM], count: 1 }),
  },
  // Update work item (transition / tags): PATCH /wit/workitems/{id}
  {
    method: 'PATCH',
    pattern: /\/wit\/workitems\/\d+\?/,
    respond: () => jsonResponse(AZDO_WORK_ITEM),
  },
];

function createAzdoFetcher() {
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

const AZDO_ENV = {
  AZDO_ORG: 'test-org',
  AZDO_PROJECT: 'test-project',
  AZDO_PAT: 'test-pat-abc123',
  CLANCY_LABEL: 'clancy',
};

// ─── Shared test setup ───────────────────────────────────────────────────────

function setup(overrides?: {
  readonly exitCode?: number;
  readonly fetcher?: (url: string, init?: RequestInit) => Promise<Response>;
}): PipelineSetup {
  return setupPipeline({
    envVars: AZDO_ENV,
    fetcher: overrides?.fetcher ?? createAzdoFetcher(),
    exitCode: overrides?.exitCode,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe('Azure DevOps pipeline — happy path', { timeout: 30_000 }, () => {
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

    // AzDo work item 42 → branch feature/azdo-42
    const branches = repo.exec(['branch', '--list']).trim();
    expect(branches).toContain('feature/azdo-42');
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
    expect(content).toContain('azdo-42');
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

  it('aborts at ticket-fetch when WIQL returns no work items', async () => {
    const baseFetcher = createAzdoFetcher();
    const emptyFetcher = async (url: string, init?: RequestInit) => {
      if (/\/wit\/wiql\?/.test(url) && init?.method === 'POST') {
        return jsonResponse({ workItems: [] });
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
