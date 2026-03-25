import type { BoardConfig } from '~/c/schemas/env/env.js';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deliverEpicToBase } from './deliver-epic.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type ExecGit = (args: readonly string[]) => string;

function makeExec(): ExecGit {
  return (args: readonly string[]): string => {
    const cmd = args[0];

    // detectRemote: remote get-url
    if (cmd === 'remote') return 'https://github.com/acme/app.git';

    return '';
  };
}

function makeProgressFs() {
  return {
    readFile: vi.fn((): string => {
      throw new Error('ENOENT');
    }),
    appendFile: vi.fn(),
    mkdir: vi.fn(),
  };
}

const mockConfig = {
  provider: 'github',
  env: {
    GITHUB_TOKEN: 'ghp_test',
    CLANCY_GIT_API_URL: undefined,
    CLANCY_GIT_PLATFORM: undefined,
  },
} as BoardConfig;

function successFetch() {
  return vi.fn((_url: string, _init: RequestInit) =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          html_url: 'https://github.com/acme/app/pull/99',
          number: 99,
        }),
        { status: 201 },
      ),
    ),
  );
}

function failureFetch(status = 422) {
  return vi.fn((_url: string, _init: RequestInit) =>
    Promise.resolve(
      new Response(JSON.stringify({ message: 'Validation Failed' }), {
        status,
      }),
    ),
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('deliverEpicToBase', () => {
  let exec: ExecGit;
  let progressFs: ReturnType<typeof makeProgressFs>;

  beforeEach(() => {
    exec = makeExec();
    progressFs = makeProgressFs();
  });

  it('returns created outcome when PR succeeds', async () => {
    const result = await deliverEpicToBase({
      exec,
      fetchFn: successFetch(),
      progressFs,
      projectRoot: '/repo',
      config: mockConfig,
      epicKey: 'PROJ-100',
      epicTitle: 'Epic title',
      epicBranch: 'epic/proj-100',
      baseBranch: 'main',
    });

    expect(result.ok).toBe(true);
    expect(result.outcome.type).toBe('created');
  });

  it('appends EPIC_PR_CREATED progress on success', async () => {
    await deliverEpicToBase({
      exec,
      fetchFn: successFetch(),
      progressFs,
      projectRoot: '/repo',
      config: mockConfig,
      epicKey: 'PROJ-100',
      epicTitle: 'Epic title',
      epicBranch: 'epic/proj-100',
      baseBranch: 'main',
    });

    expect(progressFs.appendFile).toHaveBeenCalled();
    const call = progressFs.appendFile.mock.calls[0] as [string, string];
    expect(call[1]).toContain('EPIC_PR_CREATED');
    expect(call[1]).toContain('PROJ-100');
  });

  it('returns ok true for exists outcome', async () => {
    const fetchFn = vi.fn((_url: string, _init: RequestInit) =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            message: 'Validation Failed',
            errors: [{ message: 'A pull request already exists' }],
          }),
          { status: 422 },
        ),
      ),
    );

    const result = await deliverEpicToBase({
      exec,
      fetchFn,
      progressFs,
      projectRoot: '/repo',
      config: mockConfig,
      epicKey: 'PROJ-100',
      epicTitle: 'Epic title',
      epicBranch: 'epic/proj-100',
      baseBranch: 'main',
    });

    expect(result.ok).toBe(true);
    expect(result.outcome.type).toBe('exists');
  });

  it('returns ok false for failed outcome', async () => {
    const result = await deliverEpicToBase({
      exec,
      fetchFn: failureFetch(),
      progressFs,
      projectRoot: '/repo',
      config: mockConfig,
      epicKey: 'PROJ-100',
      epicTitle: 'Epic title',
      epicBranch: 'epic/proj-100',
      baseBranch: 'main',
    });

    expect(result.ok).toBe(false);
    expect(result.outcome.type).toBe('failed');
  });

  it('returns not_attempted when no credentials', async () => {
    const noTokenConfig = {
      provider: 'github',
      env: {},
    } as BoardConfig;

    const result = await deliverEpicToBase({
      exec,
      fetchFn: successFetch(),
      progressFs,
      projectRoot: '/repo',
      config: noTokenConfig,
      epicKey: 'PROJ-100',
      epicTitle: 'Epic title',
      epicBranch: 'epic/proj-100',
      baseBranch: 'main',
    });

    expect(result.ok).toBe(false);
    expect(result.outcome.type).toBe('not_attempted');
  });

  it('returns local when no remote configured', async () => {
    const noRemoteExec: ExecGit = (args) => {
      if (args[0] === 'remote') throw new Error('no remote');
      return '';
    };

    const result = await deliverEpicToBase({
      exec: noRemoteExec,
      fetchFn: successFetch(),
      progressFs,
      projectRoot: '/repo',
      config: mockConfig,
      epicKey: 'PROJ-100',
      epicTitle: 'Epic title',
      epicBranch: 'epic/proj-100',
      baseBranch: 'main',
    });

    expect(result.ok).toBe(false);
    expect(result.outcome.type).toBe('local');
  });

  it('gathers child entries from progress and passes to PR body', async () => {
    // Set up progress with child entries under PROJ-100
    const lines = [
      '2024-01-15 14:30 | PROJ-101 | Child task 1 | PR_CREATED | pr:42 | parent:PROJ-100',
      '2024-01-15 15:00 | PROJ-102 | Child task 2 | PUSHED | parent:PROJ-100',
    ].join('\n');

    progressFs.readFile.mockReturnValue(lines);

    const fetchFn = successFetch();

    await deliverEpicToBase({
      exec,
      fetchFn,
      progressFs,
      projectRoot: '/repo',
      config: mockConfig,
      epicKey: 'PROJ-100',
      epicTitle: 'Epic title',
      epicBranch: 'epic/proj-100',
      baseBranch: 'main',
    });

    // PR body should contain child entries
    const call = fetchFn.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(call[1].body as string) as { body: string };
    expect(body.body).toContain('PROJ-101');
    expect(body.body).toContain('PROJ-102');
  });

  it('uses feat commit type in PR title', async () => {
    const fetchFn = successFetch();

    await deliverEpicToBase({
      exec,
      fetchFn,
      progressFs,
      projectRoot: '/repo',
      config: mockConfig,
      epicKey: 'PROJ-100',
      epicTitle: 'Epic title',
      epicBranch: 'epic/proj-100',
      baseBranch: 'main',
    });

    const call = fetchFn.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(call[1].body as string) as { title: string };
    expect(body.title).toBe('feat(PROJ-100): Epic title');
  });

  it('appends PUSHED progress on failed outcome', async () => {
    await deliverEpicToBase({
      exec,
      fetchFn: failureFetch(),
      progressFs,
      projectRoot: '/repo',
      config: mockConfig,
      epicKey: 'PROJ-100',
      epicTitle: 'Epic title',
      epicBranch: 'epic/proj-100',
      baseBranch: 'main',
    });

    expect(progressFs.appendFile).toHaveBeenCalled();
    const call = progressFs.appendFile.mock.calls[0] as [string, string];
    expect(call[1]).toContain('PUSHED');
    expect(call[1]).not.toContain('EPIC_PR_CREATED');
  });

  it('creates PR with empty body when no child entries exist', async () => {
    const fetchFn = successFetch();

    const result = await deliverEpicToBase({
      exec,
      fetchFn,
      progressFs,
      projectRoot: '/repo',
      config: mockConfig,
      epicKey: 'PROJ-100',
      epicTitle: 'Epic title',
      epicBranch: 'epic/proj-100',
      baseBranch: 'main',
    });

    expect(result.ok).toBe(true);
    // PR body should still have the epic header even with no children
    const call = fetchFn.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(call[1].body as string) as { body: string };
    expect(body.body).toContain('PROJ-100');
  });

  it('includes PR number in created outcome', async () => {
    const result = await deliverEpicToBase({
      exec,
      fetchFn: successFetch(),
      progressFs,
      projectRoot: '/repo',
      config: mockConfig,
      epicKey: 'PROJ-100',
      epicTitle: 'Epic title',
      epicBranch: 'epic/proj-100',
      baseBranch: 'main',
    });

    expect(result.outcome.type).toBe('created');
    if (result.outcome.type === 'created') {
      expect(result.outcome.number).toBe(99);
    }
  });
});
