/**
 * Integration test: Linear board — full pipeline happy path.
 *
 * Exercises the complete 13-phase pipeline with:
 * - Real git operations (temp repo with bare remote)
 * - DI fetcher returning canned Linear GraphQL responses
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

import { jsonResponse, LINEAR_ENV, setupPipeline } from './pipeline-helpers.js';

// ─── Linear GraphQL mock fetcher ────────────────────────────────────────────

/** Canned viewer response for ping. */
const VIEWER_RESPONSE = {
  data: { viewer: { id: 'user-uuid-123' } },
};

/** Canned assigned issues response. */
const ISSUES_RESPONSE = {
  data: {
    viewer: {
      assignedIssues: {
        nodes: [
          {
            id: 'issue-uuid-42',
            identifier: 'ENG-42',
            title: 'Add widget feature',
            description: 'Implement the widget.\n\nEpic: ENG-10',
            parent: { identifier: 'ENG-10', title: 'Widget epic' },
            labels: { nodes: [{ name: 'clancy' }] },
          },
        ],
      },
    },
  },
};

/** Canned children status response (no children found). */
const EMPTY_SEARCH_RESPONSE = {
  data: { issueSearch: { nodes: [] } },
};

/** Canned children via native parent (fallback). */
const EMPTY_CHILDREN_RESPONSE = {
  data: { issue: { children: { nodes: [] } } },
};

/** Canned blocker response (no blockers). */
const NO_BLOCKERS_RESPONSE = {
  data: { issue: { relations: { nodes: [] } } },
};

/** Canned workflow states for transitions. */
const WORKFLOW_STATES_RESPONSE = {
  data: { workflowStates: { nodes: [{ id: 'state-uuid-inprogress' }] } },
};

/** Canned transition success. */
const TRANSITION_RESPONSE = {
  data: { issueUpdate: { success: true } },
};

/** Canned label lookup responses. */
const TEAM_LABELS_RESPONSE = {
  data: {
    team: { labels: { nodes: [{ id: 'label-uuid-1', name: 'clancy' }] } },
  },
};

/** Canned issue lookup for label operations. */
const ISSUE_WITH_LABELS_RESPONSE = {
  data: {
    issueSearch: {
      nodes: [
        {
          id: 'issue-uuid-42',
          labels: { nodes: [{ id: 'label-uuid-1', name: 'clancy' }] },
        },
      ],
    },
  },
};

/**
 * Linear uses a single GraphQL endpoint. Route by inspecting the query body.
 */
function createLinearFetcher() {
  return async (url: string, init?: RequestInit): Promise<Response> => {
    // All Linear calls go to the same GraphQL endpoint
    if (!url.includes('linear.app/graphql')) {
      return new Response('Not Found', { status: 404 });
    }

    const body = JSON.parse((init?.body as string) ?? '{}') as {
      readonly query?: string;
    };
    const query = body.query ?? '';

    // Ping: viewer { id }
    if (query.includes('viewer') && !query.includes('assignedIssues')) {
      return jsonResponse(VIEWER_RESPONSE);
    }

    // Fetch issues: assignedIssues
    if (query.includes('assignedIssues')) {
      return jsonResponse(ISSUES_RESPONSE);
    }

    // Blocker check: relations
    if (query.includes('relations')) {
      return jsonResponse(NO_BLOCKERS_RESPONSE);
    }

    // Children by search: issueSearch with state
    if (query.includes('issueSearch') && query.includes('state')) {
      return jsonResponse(EMPTY_SEARCH_RESPONSE);
    }

    // Children by native parent: issue.children
    if (query.includes('children')) {
      return jsonResponse(EMPTY_CHILDREN_RESPONSE);
    }

    // Workflow states lookup
    if (query.includes('workflowStates')) {
      return jsonResponse(WORKFLOW_STATES_RESPONSE);
    }

    // Transition: issueUpdate with stateId
    if (query.includes('issueUpdate') && query.includes('stateId')) {
      return jsonResponse(TRANSITION_RESPONSE);
    }

    // Team labels lookup
    if (query.includes('team') && query.includes('labels')) {
      return jsonResponse(TEAM_LABELS_RESPONSE);
    }

    // Issue label lookup (by identifier)
    if (query.includes('issueSearch') && query.includes('identifier')) {
      return jsonResponse(ISSUE_WITH_LABELS_RESPONSE);
    }

    // Label update (issueUpdate with labelIds)
    if (query.includes('issueUpdate') && query.includes('labelIds')) {
      return jsonResponse(TRANSITION_RESPONSE);
    }

    // Label create
    if (query.includes('issueLabelCreate')) {
      return jsonResponse({
        data: {
          issueLabelCreate: { issueLabel: { id: 'new-label' }, success: true },
        },
      });
    }

    // Workspace labels
    if (query.includes('issueLabels')) {
      return jsonResponse({ data: { issueLabels: { nodes: [] } } });
    }

    return new Response('Not Found', { status: 404 });
  };
}

// ─── Shared test setup ───────────────────────────────────────────────────────

function setup(overrides?: {
  readonly exitCode?: number;
  readonly fetcher?: (url: string, init?: RequestInit) => Promise<Response>;
}): PipelineSetup {
  return setupPipeline({
    envVars: LINEAR_ENV,
    fetcher: overrides?.fetcher ?? createLinearFetcher(),
    exitCode: overrides?.exitCode,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe('Linear pipeline — happy path', { timeout: 30_000 }, () => {
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

    // Linear ENG-42 → branch feature/eng-42
    const branches = repo.exec(['branch', '--list']).trim();
    expect(branches).toContain('feature/eng-42');
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
    expect(content).toContain('ENG-42');
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
    const baseFetcher = createLinearFetcher();
    const emptyFetcher = async (url: string, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) ?? '{}') as {
        readonly query?: string;
      };
      if (body.query?.includes('assignedIssues')) {
        return jsonResponse({
          data: { viewer: { assignedIssues: { nodes: [] } } },
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
