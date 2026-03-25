import type { PrRetryDeps } from './pr-retry.js';
import type { BoardConfig } from '~/c/schemas/env/env.js';
import type { ProgressEntry } from '~/c/shared/progress/index.js';
import type { PrCreationResult, RemoteInfo } from '~/c/types/remote.js';

import { describe, expect, it, vi } from 'vitest';

import { RunContext } from '../context.js';
import { prRetry } from './pr-retry.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const githubRemote: RemoteInfo = {
  host: 'github',
  owner: 'acme',
  repo: 'app',
  hostname: 'github.com',
};

function makeCtx(): RunContext {
  const ctx = new RunContext({
    projectRoot: '/repo',
    argv: [],
  });

  ctx.setPreflight(
    {
      provider: 'github',
      env: { GITHUB_TOKEN: 'ghp_test', CLANCY_BASE_BRANCH: 'main' },
    } as BoardConfig,
    {
      fetchChildrenStatus: vi.fn(),
      fetchTicket: vi.fn(),
      fetchTickets: vi.fn(),
      fetchBlockerStatus: vi.fn(),
      transitionTicket: vi.fn(),
      addLabel: vi.fn(),
      removeLabel: vi.fn(),
      ensureLabel: vi.fn(),
      validateInputs: vi.fn(),
      ping: vi.fn(),
      sharedEnv: vi.fn(),
    },
  );

  return ctx;
}

function makeEntry(key: string, parent?: string): ProgressEntry {
  return {
    timestamp: '2024-01-15 14:30',
    key,
    summary: `Task ${key}`,
    status: 'PUSHED',
    parent,
  };
}

function makeDeps(
  overrides: {
    readonly retryable?: readonly ProgressEntry[];
    readonly remote?: RemoteInfo;
    readonly prResult?: PrCreationResult | undefined;
  } = {},
): PrRetryDeps {
  const retryable = overrides.retryable ?? [];
  const remote = overrides.remote ?? githubRemote;
  const prResult =
    'prResult' in overrides
      ? overrides.prResult
      : ({
          ok: true,
          url: 'https://github.com/acme/app/pull/1',
          number: 1,
        } as PrCreationResult);

  return {
    findRetryable: vi.fn(() => retryable),
    detectRemote: vi.fn(() => remote),
    retryEntry: vi.fn(() => Promise.resolve(prResult)),
    appendProgress: vi.fn(),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('prRetry', () => {
  it('returns empty results when no retryable entries', async () => {
    const result = await prRetry(makeCtx(), makeDeps());

    expect(result.results).toHaveLength(0);
  });

  it('retries PR creation for each retryable entry', async () => {
    const entries = [makeEntry('PROJ-1'), makeEntry('PROJ-2')];
    const deps = makeDeps({ retryable: entries });

    const result = await prRetry(makeCtx(), deps);

    expect(deps.retryEntry).toHaveBeenCalledTimes(2);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]!.key).toBe('PROJ-1');
    expect(result.results[0]!.status).toBe('created');
  });

  it('records exists status when PR already exists', async () => {
    const entries = [makeEntry('PROJ-1')];
    const prResult: PrCreationResult = {
      ok: false,
      error: 'exists',
      alreadyExists: true,
    };
    const deps = makeDeps({ retryable: entries, prResult });

    const result = await prRetry(makeCtx(), deps);

    expect(result.results[0]!.status).toBe('exists');
  });

  it('records failed status when PR creation fails', async () => {
    const entries = [makeEntry('PROJ-1')];
    const prResult: PrCreationResult = { ok: false, error: 'API error' };
    const deps = makeDeps({ retryable: entries, prResult });

    const result = await prRetry(makeCtx(), deps);

    expect(result.results[0]!.status).toBe('failed');
  });

  it('records skipped status when no credentials', async () => {
    const entries = [makeEntry('PROJ-1')];
    const deps = makeDeps({ retryable: entries, prResult: undefined });

    const result = await prRetry(makeCtx(), deps);

    expect(result.results[0]!.status).toBe('skipped');
  });

  it('marks all entries as unsupported for none/unknown remotes', async () => {
    const entries = [makeEntry('PROJ-1'), makeEntry('PROJ-2')];
    const deps = makeDeps({
      retryable: entries,
      remote: { host: 'none' },
    });

    const result = await prRetry(makeCtx(), deps);

    expect(deps.retryEntry).not.toHaveBeenCalled();
    expect(result.results).toHaveLength(2);
    expect(result.results[0]!.status).toBe('unsupported');
    expect(deps.appendProgress).toHaveBeenCalledTimes(2);
  });

  it('appends PR_CREATED progress on success', async () => {
    const entries = [makeEntry('PROJ-1', 'PROJ-100')];
    const deps = makeDeps({ retryable: entries });

    await prRetry(makeCtx(), deps);

    expect(deps.appendProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'PROJ-1',
        status: 'PR_CREATED',
        prNumber: 1,
        parent: 'PROJ-100',
      }),
    );
  });

  it('appends PR_CREATED progress on exists', async () => {
    const entries = [makeEntry('PROJ-1')];
    const prResult: PrCreationResult = {
      ok: false,
      error: 'exists',
      alreadyExists: true,
    };
    const deps = makeDeps({ retryable: entries, prResult });

    await prRetry(makeCtx(), deps);

    expect(deps.appendProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'PROJ-1',
        status: 'PR_CREATED',
      }),
    );
  });

  it('does not append progress on failure', async () => {
    const entries = [makeEntry('PROJ-1')];
    const prResult: PrCreationResult = { ok: false, error: 'API error' };
    const deps = makeDeps({ retryable: entries, prResult });

    await prRetry(makeCtx(), deps);

    expect(deps.appendProgress).not.toHaveBeenCalled();
  });

  it('catches sync errors and returns empty results', async () => {
    const deps: PrRetryDeps = {
      findRetryable: vi.fn(() => {
        throw new Error('progress read failed');
      }),
      detectRemote: vi.fn(() => githubRemote),
      retryEntry: vi.fn(),
      appendProgress: vi.fn(),
    };

    const result = await prRetry(makeCtx(), deps);

    expect(result.results).toHaveLength(0);
  });

  it('catches async rejection from retryEntry', async () => {
    const entries = [makeEntry('PROJ-1')];
    const deps: PrRetryDeps = {
      findRetryable: vi.fn(() => entries),
      detectRemote: vi.fn(() => githubRemote),
      retryEntry: vi.fn(() => Promise.reject(new Error('network'))),
      appendProgress: vi.fn(),
    };

    const result = await prRetry(makeCtx(), deps);

    expect(result.results).toHaveLength(0);
  });

  it('marks entries as unsupported for unknown remote', async () => {
    const entries = [makeEntry('PROJ-1')];
    const deps = makeDeps({
      retryable: entries,
      remote: { host: 'unknown', url: 'git@custom.example.com:repo.git' },
    });

    const result = await prRetry(makeCtx(), deps);

    expect(result.results[0]!.status).toBe('unsupported');
  });

  it('normalises parent "none" to undefined', async () => {
    const entries = [makeEntry('PROJ-1', 'none')];
    const deps = makeDeps({ retryable: entries });

    await prRetry(makeCtx(), deps);

    expect(deps.appendProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        parent: undefined,
      }),
    );
  });
});
