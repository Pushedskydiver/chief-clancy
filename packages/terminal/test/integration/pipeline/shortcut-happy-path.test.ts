/**
 * Integration test: Shortcut board — full pipeline happy path.
 *
 * Exercises the complete 13-phase pipeline with:
 * - Real git operations (temp repo with bare remote)
 * - DI fetcher returning canned Shortcut API responses
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

// ─── Shortcut API mock fetcher ──────────────────────────────────────────────

const SHORTCUT_MEMBER = { id: 'member-uuid-123', profile: { name: 'Test' } };

const SHORTCUT_WORKFLOWS = [
  {
    id: 1,
    name: 'Default',
    states: [
      { id: 500000010, name: 'Unstarted', type: 'unstarted' },
      { id: 500000020, name: 'In Progress', type: 'started' },
      { id: 500000030, name: 'Done', type: 'done' },
    ],
  },
];

const SHORTCUT_STORY = {
  id: 42,
  name: 'Add widget feature',
  description: 'Implement the widget.\n\nEpic: sc-100',
  workflow_state_id: 500000010,
  epic_id: 100,
  labels: [{ id: 1, name: 'clancy' }],
  story_links: [],
};

/** Route definitions for the Shortcut mock fetcher. */
const ROUTES: ReadonlyArray<{
  readonly method: string;
  readonly pattern: RegExp;
  readonly respond: (url: string, init?: RequestInit) => Response;
}> = [
  // Ping: GET /member-info
  {
    method: 'GET',
    pattern: /\/member-info$/,
    respond: () => jsonResponse(SHORTCUT_MEMBER),
  },
  // Fetch workflows: GET /workflows
  {
    method: 'GET',
    pattern: /\/workflows$/,
    respond: () => jsonResponse(SHORTCUT_WORKFLOWS),
  },
  // Search stories: POST /stories/search
  {
    method: 'POST',
    pattern: /\/stories\/search$/,
    respond: (_url, init) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        readonly query?: string;
      };
      // Children status queries use the query field
      if (body.query) {
        return jsonResponse({ data: [] });
      }
      return jsonResponse({ data: [SHORTCUT_STORY] });
    },
  },
  // Transition / update story: PUT /stories/{id}
  {
    method: 'PUT',
    pattern: /\/stories\/\d+$/,
    respond: () => jsonResponse({ id: 42 }),
  },
  // Fetch single story (blockers): GET /stories/{id}
  {
    method: 'GET',
    pattern: /\/stories\/\d+$/,
    respond: () =>
      jsonResponse({
        ...SHORTCUT_STORY,
        blocked: false,
        story_links: [],
      }),
  },
  // Fetch epic stories (children fallback): GET /epics/{id}/stories
  {
    method: 'GET',
    pattern: /\/epics\/\d+\/stories$/,
    respond: () => jsonResponse([]),
  },
  // Fetch labels: GET /labels
  {
    method: 'GET',
    pattern: /\/labels$/,
    respond: () => jsonResponse([{ id: 1, name: 'clancy' }]),
  },
  // Create label: POST /labels
  {
    method: 'POST',
    pattern: /\/labels$/,
    respond: () => jsonResponse({ id: 2, name: 'new-label' }, 201),
  },
];

function createShortcutFetcher() {
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

const SHORTCUT_ENV = {
  SHORTCUT_API_TOKEN: 'sc-test-token-abc123',
  CLANCY_LABEL: 'clancy',
};

// ─── Shared test setup ───────────────────────────────────────────────────────

function setup(overrides?: {
  readonly exitCode?: number;
  readonly fetcher?: (url: string, init?: RequestInit) => Promise<Response>;
}): PipelineSetup {
  return setupPipeline({
    envVars: SHORTCUT_ENV,
    fetcher: overrides?.fetcher ?? createShortcutFetcher(),
    exitCode: overrides?.exitCode,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe('Shortcut pipeline — happy path', { timeout: 30_000 }, () => {
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

    // Shortcut story 42 → branch feature/sc-42
    const branches = repo.exec(['branch', '--list']).trim();
    expect(branches).toContain('feature/sc-42');
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
    expect(content).toContain('sc-42');
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

  it('aborts at ticket-fetch when board returns no stories', async () => {
    const baseFetcher = createShortcutFetcher();
    const emptyFetcher = async (url: string, init?: RequestInit) => {
      if (/\/stories\/search$/.test(url) && init?.method === 'POST') {
        return jsonResponse({ data: [] });
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
