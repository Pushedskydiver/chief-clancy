import type { ProgressEntry } from '~/d/lifecycle/progress.js';

import { describe, expect, it, vi } from 'vitest';

import {
  buildEpicContext,
  ensureEpicBranch,
  gatherChildEntries,
} from './epic.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type ExecGit = (args: readonly string[]) => string;

type MockExecOpts = {
  readonly remoteBranchExists?: boolean;
  readonly localBranchExists?: boolean;
  readonly fetchSucceeds?: boolean;
  readonly pushSucceeds?: boolean;
  readonly createThrows?: boolean;
};

/** Handle read-only git commands (ls-remote, show-ref). */
function handleReadCmd(
  cmd: string,
  opts: Required<MockExecOpts>,
): string | undefined {
  if (cmd === 'ls-remote') {
    return opts.remoteBranchExists ? 'abc123\trefs/heads/epic/proj-100' : '';
  }
  if (cmd === 'show-ref') {
    if (!opts.localBranchExists) throw new Error('not found');
    return '';
  }
  return undefined;
}

function makeExec(overrides: MockExecOpts = {}): ExecGit {
  const opts: Required<MockExecOpts> = {
    remoteBranchExists: false,
    localBranchExists: false,
    fetchSucceeds: true,
    pushSucceeds: true,
    createThrows: false,
    ...overrides,
  };

  return (args: readonly string[]): string => {
    const cmd = args[0] ?? '';
    const read = handleReadCmd(cmd, opts);
    if (read !== undefined) return read;

    if (cmd === 'fetch') {
      if (!opts.fetchSucceeds) throw new Error('fetch failed');
      return '';
    }
    if (cmd === 'checkout') {
      if (opts.createThrows) throw new Error('checkout failed');
      return '';
    }
    if (cmd === 'push') {
      if (!opts.pushSucceeds) throw new Error('push failed');
      return '';
    }
    return '';
  };
}

function makeProgressFs(entries: readonly ProgressEntry[] = []) {
  return {
    readFile: vi.fn((): string => {
      if (entries.length === 0) throw new Error('ENOENT');
      return entries
        .map(
          (e) =>
            `${e.timestamp} | ${e.key} | ${e.summary} | ${e.status}${e.prNumber ? ` | pr:${e.prNumber}` : ''}${e.parent ? ` | parent:${e.parent}` : ''}`,
        )
        .join('\n');
    }),
    appendFile: vi.fn(),
    mkdir: vi.fn(),
  };
}

// ─── ensureEpicBranch ────────────────────────────────────────────────────────

describe('ensureEpicBranch', () => {
  it('fetches from remote when branch exists remotely', () => {
    const result = ensureEpicBranch({
      exec: makeExec({ remoteBranchExists: true }),
      epicBranch: 'epic/proj-100',
      baseBranch: 'main',
    });

    expect(result.ok).toBe(true);
  });

  it('returns error when remote fetch fails', () => {
    const result = ensureEpicBranch({
      exec: makeExec({ remoteBranchExists: true, fetchSucceeds: false }),
      epicBranch: 'epic/proj-100',
      baseBranch: 'main',
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'unknown',
        message: expect.stringContaining('Could not fetch'),
      },
    });
  });

  it('returns error when branch exists locally but not on remote', () => {
    const result = ensureEpicBranch({
      exec: makeExec({ localBranchExists: true }),
      epicBranch: 'epic/proj-100',
      baseBranch: 'main',
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'unknown',
        message: expect.stringContaining('exists locally but not on remote'),
      },
    });
  });

  it('creates fresh branch when it does not exist anywhere', () => {
    const result = ensureEpicBranch({
      exec: makeExec(),
      epicBranch: 'epic/proj-100',
      baseBranch: 'main',
    });

    expect(result.ok).toBe(true);
  });

  it('returns error when push fails after creation', () => {
    const result = ensureEpicBranch({
      exec: makeExec({ pushSucceeds: false }),
      epicBranch: 'epic/proj-100',
      baseBranch: 'main',
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'unknown',
        message: expect.stringContaining('could not push'),
      },
    });
  });

  it('returns error when branch creation throws', () => {
    const result = ensureEpicBranch({
      exec: makeExec({ createThrows: true }),
      epicBranch: 'epic/proj-100',
      baseBranch: 'main',
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'unknown',
        message: expect.stringContaining('Could not create'),
      },
    });
  });
});

// ─── buildEpicContext ────────────────────────────────────────────────────────

describe('buildEpicContext', () => {
  it('returns undefined when no parent', () => {
    const result = buildEpicContext({
      progressFs: makeProgressFs(),
      projectRoot: '/tmp',
      parent: undefined,
      targetBranch: 'epic/proj-100',
      ticketKey: 'PROJ-42',
    });

    expect(result).toBeUndefined();
  });

  it('returns undefined when target is not an epic branch', () => {
    const result = buildEpicContext({
      progressFs: makeProgressFs(),
      projectRoot: '/tmp',
      parent: 'PROJ-100',
      targetBranch: 'main',
      ticketKey: 'PROJ-42',
    });

    expect(result).toBeUndefined();
  });

  it('returns context with sibling count', () => {
    const entries: readonly ProgressEntry[] = [
      {
        timestamp: '2026-03-25 10:00',
        key: 'PROJ-41',
        summary: 'Sibling',
        status: 'PR_CREATED',
        prNumber: 5,
        parent: 'PROJ-100',
      },
    ];

    const result = buildEpicContext({
      progressFs: makeProgressFs(entries),
      projectRoot: '/tmp',
      parent: 'PROJ-100',
      targetBranch: 'epic/proj-100',
      ticketKey: 'PROJ-42',
    });

    expect(result).toEqual({
      parentKey: 'PROJ-100',
      siblingsDelivered: 1,
      epicBranch: 'epic/proj-100',
    });
  });

  it('excludes current ticket from sibling count', () => {
    const entries: readonly ProgressEntry[] = [
      {
        timestamp: '2026-03-25 10:00',
        key: 'PROJ-42',
        summary: 'Self',
        status: 'PR_CREATED',
        prNumber: 5,
        parent: 'PROJ-100',
      },
    ];

    const result = buildEpicContext({
      progressFs: makeProgressFs(entries),
      projectRoot: '/tmp',
      parent: 'PROJ-100',
      targetBranch: 'epic/proj-100',
      ticketKey: 'PROJ-42',
    });

    expect(result?.siblingsDelivered).toBe(0);
  });

  it('counts siblings across mixed delivered statuses', () => {
    const entries: readonly ProgressEntry[] = [
      {
        timestamp: '2026-03-25 10:00',
        key: 'PROJ-41',
        summary: 'Created',
        status: 'PR_CREATED',
        prNumber: 5,
        parent: 'PROJ-100',
      },
      {
        timestamp: '2026-03-25 11:00',
        key: 'PROJ-43',
        summary: 'Pushed',
        status: 'PUSHED',
        prNumber: 6,
        parent: 'PROJ-100',
      },
      {
        timestamp: '2026-03-25 12:00',
        key: 'PROJ-44',
        summary: 'Reworked',
        status: 'REWORK',
        prNumber: 7,
        parent: 'PROJ-100',
      },
    ];

    const result = buildEpicContext({
      progressFs: makeProgressFs(entries),
      projectRoot: '/tmp',
      parent: 'PROJ-100',
      targetBranch: 'epic/proj-100',
      ticketKey: 'PROJ-42',
    });

    expect(result?.siblingsDelivered).toBe(3);
  });
});

// ─── gatherChildEntries ──────────────────────────────────────────────────────

describe('gatherChildEntries', () => {
  it('returns entries matching epic key as parent', () => {
    const entries: readonly ProgressEntry[] = [
      {
        timestamp: '2026-03-25 10:00',
        key: 'PROJ-41',
        summary: 'Child',
        status: 'PR_CREATED',
        prNumber: 5,
        parent: 'PROJ-100',
      },
      {
        timestamp: '2026-03-25 11:00',
        key: 'PROJ-99',
        summary: 'Other',
        status: 'PR_CREATED',
        prNumber: 6,
        parent: 'PROJ-200',
      },
    ];

    const result = gatherChildEntries({
      progressFs: makeProgressFs(entries),
      projectRoot: '/tmp',
      epicKey: 'PROJ-100',
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.key).toBe('PROJ-41');
  });

  it('returns empty array when no children exist', () => {
    const result = gatherChildEntries({
      progressFs: makeProgressFs(),
      projectRoot: '/tmp',
      epicKey: 'PROJ-100',
    });

    expect(result).toHaveLength(0);
  });
});
