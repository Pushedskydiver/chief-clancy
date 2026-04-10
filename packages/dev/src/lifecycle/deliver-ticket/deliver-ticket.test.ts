import type { BoardConfig } from '~/c/schemas/env/env.js';
import type { FetchedTicket } from '~/c/types/board.js';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deliverViaPullRequest } from './deliver-ticket.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type ExecGit = (args: readonly string[]) => string;

function makeExec(
  overrides: { readonly pushSucceeds?: boolean } = {},
): ExecGit {
  const { pushSucceeds = true } = overrides;

  return (args: readonly string[]): string => {
    const cmd = args[0];

    if (cmd === 'push') {
      if (!pushSucceeds) throw new Error('push failed');
      return '';
    }

    // detectRemote: remote get-url
    if (cmd === 'remote') return 'https://github.com/acme/app.git';

    // checkout
    if (cmd === 'checkout') return '';

    // show-ref (branchExists)
    if (cmd === 'show-ref') throw new Error('not found');

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

function makeDeliverFs(verifyAttempt?: string) {
  return {
    readFile: vi.fn((): string => {
      if (verifyAttempt !== undefined) return verifyAttempt;
      throw new Error('ENOENT');
    }),
  };
}

const mockFetchFn = vi.fn((url: string, _init: RequestInit) =>
  Promise.resolve(
    new Response(JSON.stringify({ html_url: url, number: 1 }), {
      status: 201,
    }),
  ),
);

const mockConfig = {
  provider: 'github',
  env: {
    GITHUB_TOKEN: 'ghp_test',
    CLANCY_GIT_API_URL: undefined,
    CLANCY_GIT_PLATFORM: undefined,
  },
} as BoardConfig;

const mockTicket: FetchedTicket = {
  key: 'PROJ-42',
  title: 'Add login page',
  description: 'Adds a login page.',
  parentInfo: 'none',
  blockers: 'None',
};

function makeOpts(
  overrides: {
    readonly pushSucceeds?: boolean;
    readonly skipLog?: boolean;
    readonly parent?: string;
    readonly verifyAttempt?: string;
    readonly ticketType?: string;
  } = {},
) {
  const ticket = overrides.ticketType
    ? { ...mockTicket, ticketType: overrides.ticketType }
    : mockTicket;

  return {
    exec: makeExec({ pushSucceeds: overrides.pushSucceeds }),
    fetchFn: mockFetchFn,
    progressFs: makeProgressFs(),
    deliverFs: makeDeliverFs(overrides.verifyAttempt),
    projectRoot: '/tmp',
    config: mockConfig,
    ticket,
    ticketBranch: 'feature/proj-42',
    targetBranch: 'main',
    skipLog: overrides.skipLog,
    parent: overrides.parent,
  };
}

// ─── deliverViaPullRequest ───────────────────────────────────────────────────

describe('deliverViaPullRequest', () => {
  beforeEach(() => {
    mockFetchFn.mockClear();
  });

  it('returns pushed true and created outcome on success', async () => {
    const opts = makeOpts();
    const result = await deliverViaPullRequest(opts);

    expect(result.pushed).toBe(true);
    expect(result.outcome.type).toBe('created');
  });

  it('appends progress on successful delivery', async () => {
    const opts = makeOpts();
    await deliverViaPullRequest(opts);

    expect(opts.progressFs.appendFile).toHaveBeenCalled();
    const content = opts.progressFs.appendFile.mock.calls[0]![1] as string;
    expect(content).toContain('PR_CREATED');
    expect(content).toContain('PROJ-42');
  });

  it('returns pushed false when push fails', async () => {
    const opts = makeOpts({ pushSucceeds: false });
    const result = await deliverViaPullRequest(opts);

    expect(result.pushed).toBe(false);
  });

  it('appends PUSH_FAILED progress when push fails', async () => {
    const opts = makeOpts({ pushSucceeds: false });
    await deliverViaPullRequest(opts);

    const content = opts.progressFs.appendFile.mock.calls[0]![1] as string;
    expect(content).toContain('PUSH_FAILED');
  });

  it('skips progress when skipLog is true', async () => {
    const opts = makeOpts({ skipLog: true });
    await deliverViaPullRequest(opts);

    expect(opts.progressFs.appendFile).not.toHaveBeenCalled();
  });

  it('skips PUSH_FAILED progress when skipLog and push fails', async () => {
    const opts = makeOpts({ pushSucceeds: false, skipLog: true });
    await deliverViaPullRequest(opts);

    expect(opts.progressFs.appendFile).not.toHaveBeenCalled();
  });

  it('includes parent in progress when provided', async () => {
    const opts = makeOpts({ parent: 'PROJ-100' });
    await deliverViaPullRequest(opts);

    const content = opts.progressFs.appendFile.mock.calls[0]![1] as string;
    expect(content).toContain('parent:PROJ-100');
  });

  it('includes verification warning in PR body', async () => {
    const opts = makeOpts({ verifyAttempt: '3' });
    await deliverViaPullRequest(opts);

    const fetchCall = mockFetchFn.mock.calls;
    const lastBody = fetchCall[fetchCall.length - 1]![1]?.body as string;
    expect(lastBody).toContain('Verification');
  });

  it('uses fix commit type for bug tickets', async () => {
    const opts = makeOpts({ ticketType: 'Bug' });
    await deliverViaPullRequest(opts);

    const fetchBody = mockFetchFn.mock.calls[0]![1]?.body as string;
    expect(fetchBody).toContain('fix(PROJ-42)');
  });

  it('uses feat commit type when ticketType is undefined', async () => {
    const opts = makeOpts();
    await deliverViaPullRequest(opts);

    const fetchBody = mockFetchFn.mock.calls[0]![1]?.body as string;
    expect(fetchBody).toContain('feat(PROJ-42)');
  });

  it('computes non-created outcome when PR creation fails', async () => {
    const failFetchFn = vi.fn(() =>
      Promise.resolve(new Response('Server Error', { status: 500 })),
    );
    const opts = {
      ...makeOpts(),
      fetchFn: failFetchFn,
    };

    const result = await deliverViaPullRequest(opts);

    expect(result.pushed).toBe(true);
    expect(result.outcome.type).toBe('failed');
  });

  it('threads singleChildParent through to PR body', async () => {
    const opts = {
      ...makeOpts(),
      singleChildParent: 'EPIC-100',
    };
    await deliverViaPullRequest(opts);

    const fetchBody = mockFetchFn.mock.calls[0]![1]?.body as string;
    expect(fetchBody).toContain('EPIC-100');
  });

  it('computes not_attempted outcome when remote has no matching credentials', async () => {
    const gitlabExec = (args: readonly string[]): string => {
      const cmd = args[0];
      if (cmd === 'push') return '';
      if (cmd === 'remote') return 'git@gitlab.com:acme/app.git';
      if (cmd === 'checkout') return '';
      if (cmd === 'show-ref') throw new Error('not found');
      return '';
    };

    const opts = {
      ...makeOpts(),
      exec: gitlabExec,
    };
    const result = await deliverViaPullRequest(opts);

    expect(result.pushed).toBe(true);
    expect(result.outcome.type).toBe('not_attempted');
  });
});
