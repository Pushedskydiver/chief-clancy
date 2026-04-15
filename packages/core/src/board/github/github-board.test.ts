import type { GitHubEnv } from '~/c/schemas/env.js';
import type { Fetcher } from '~/c/shared/http/fetch-and-parse.js';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createGitHubBoard, parseEpicRef } from './github-board.js';

const baseEnv: GitHubEnv = {
  GITHUB_TOKEN: 'tok_test',
  GITHUB_REPO: 'owner/repo',
};

// ── parseEpicRef ───────────────────────────────────────────────────

describe('parseEpicRef', () => {
  it('extracts Epic: #N from description', () => {
    expect(parseEpicRef('Epic: #42\nSome details')).toBe('#42');
  });

  it('extracts Parent: #N from description', () => {
    expect(parseEpicRef('Parent: #10')).toBe('#10');
  });

  it('returns undefined when no reference found', () => {
    expect(parseEpicRef('No parent here')).toBeUndefined();
  });

  it('only matches at line start', () => {
    expect(parseEpicRef('See Epic: #42')).toBeUndefined();
  });
});

// ── createGitHubBoard ──────────────────────────────────────────────

describe('createGitHubBoard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a Board object with all required methods', () => {
    const board = createGitHubBoard(baseEnv);

    expect(board.ping).toBeTypeOf('function');
    expect(board.validateInputs).toBeTypeOf('function');
    expect(board.fetchTicket).toBeTypeOf('function');
    expect(board.fetchTickets).toBeTypeOf('function');
    expect(board.fetchBlockerStatus).toBeTypeOf('function');
    expect(board.fetchChildrenStatus).toBeTypeOf('function');
    expect(board.transitionTicket).toBeTypeOf('function');
    expect(board.ensureLabel).toBeTypeOf('function');
    expect(board.addLabel).toBeTypeOf('function');
    expect(board.removeLabel).toBeTypeOf('function');
    expect(board.sharedEnv).toBeTypeOf('function');
  });

  it('validateInputs returns undefined for valid repo', () => {
    const board = createGitHubBoard(baseEnv);
    expect(board.validateInputs()).toBeUndefined();
  });

  it('validateInputs returns error for invalid repo', () => {
    const board = createGitHubBoard({
      ...baseEnv,
      GITHUB_REPO: 'invalid',
    });
    expect(board.validateInputs()).toContain('invalid');
  });

  it('sharedEnv returns the env object', () => {
    const board = createGitHubBoard(baseEnv);
    expect(board.sharedEnv()).toBe(baseEnv);
  });

  it('transitionTicket always returns false', async () => {
    const board = createGitHubBoard(baseEnv);
    const result = await board.transitionTicket(
      {
        key: '#1',
        title: 'Test',
        description: '',
        parentInfo: 'none',
        blockers: 'None',
      },
      'closed',
    );
    expect(result).toBe(false);
  });

  it('fetchTickets maps issues to FetchedTicket shape', async () => {
    const issues = [
      {
        number: 42,
        title: 'Fix bug',
        body: 'Epic: #10\nDescription',
        milestone: null,
        labels: [{ name: 'bug' }],
      },
    ];

    // Mock for resolveUsername (/user) then fetchIssues
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ login: 'octocat' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(issues), { status: 200 }),
      );

    const board = createGitHubBoard(baseEnv, mockFetch);
    const tickets = await board.fetchTickets({});

    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toEqual({
      key: '#42',
      title: 'Fix bug',
      description: 'Epic: #10\nDescription',
      parentInfo: '#10',
      blockers: 'None',
      issueId: '#42',
      labels: ['bug'],
      status: 'open',
    });
  });

  it('fetchTickets uses milestone over epic ref for parentInfo', async () => {
    const issues = [
      {
        number: 1,
        title: 'Task',
        body: 'Epic: #10',
        milestone: { title: 'Sprint 1' },
        labels: [],
      },
    ];

    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ login: 'user' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(issues), { status: 200 }),
      );

    const board = createGitHubBoard(baseEnv, mockFetch);
    const tickets = await board.fetchTickets({});

    expect(tickets[0].parentInfo).toBe('Sprint 1');
  });

  it('fetchTickets respects limit parameter', async () => {
    const issues = Array.from({ length: 5 }, (_, i) => ({
      number: i + 1,
      title: `Issue ${i + 1}`,
      body: '',
      milestone: null,
      labels: [],
    }));

    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ login: 'user' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(issues), { status: 200 }),
      );

    const board = createGitHubBoard(baseEnv, mockFetch);
    const tickets = await board.fetchTickets({ limit: 2 });

    expect(tickets).toHaveLength(2);
  });

  it('fetchTicket returns the first ticket', async () => {
    const issues = [
      { number: 1, title: 'First', body: '', labels: [] },
      { number: 2, title: 'Second', body: '', labels: [] },
    ];

    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ login: 'user' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(issues), { status: 200 }),
      );

    const board = createGitHubBoard(baseEnv, mockFetch);
    const ticket = await board.fetchTicket({});

    expect(ticket?.key).toBe('#1');
  });

  it('fetchTicket returns undefined when no issues', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ login: 'user' }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    const board = createGitHubBoard(baseEnv, mockFetch);
    const ticket = await board.fetchTicket({});

    expect(ticket).toBeUndefined();
  });

  it('fetchBlockerStatus returns false for invalid key', async () => {
    const board = createGitHubBoard(baseEnv);
    const result = await board.fetchBlockerStatus({
      key: 'invalid',
      title: '',
      description: 'Blocked by #10',
      parentInfo: 'none',
      blockers: 'None',
    });
    expect(result).toBe(false);
  });

  it('fetchBlockerStatus delegates to relations module', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(
        new Response(JSON.stringify({ state: 'open' }), { status: 200 }),
      );

    const board = createGitHubBoard(baseEnv, mockFetch);
    const result = await board.fetchBlockerStatus({
      key: '#42',
      title: '',
      description: 'Blocked by #10',
      parentInfo: 'none',
      blockers: 'None',
    });
    expect(result).toBe(true);
  });

  it('fetchChildrenStatus returns undefined for invalid key', async () => {
    const board = createGitHubBoard(baseEnv);
    const result = await board.fetchChildrenStatus('invalid');
    expect(result).toBeUndefined();
  });

  it('fetchChildrenStatus delegates to relations module', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ total_count: 3 }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ total_count: 1 }), { status: 200 }),
      );

    const board = createGitHubBoard(baseEnv, mockFetch);
    const result = await board.fetchChildrenStatus('#5');

    expect(result).toEqual({ total: 3, incomplete: 1 });
  });

  it('ensureLabel creates the label if it does not exist', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      // GET label → 404
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      // POST create → 201
      .mockResolvedValueOnce({ ok: true, status: 201 } as Response);

    const board = createGitHubBoard(baseEnv, mockFetch);
    await board.ensureLabel('clancy:build');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toContain('/labels');
    expect(mockFetch.mock.calls[1][1]).toEqual(
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('ensureLabel skips creation if label already exists', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValueOnce({
      ok: true,
    } as Response);

    const board = createGitHubBoard(baseEnv, mockFetch);
    await board.ensureLabel('existing');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('addLabel adds a label to an issue', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      // ensureLabel GET → exists
      .mockResolvedValueOnce({ ok: true } as Response)
      // addLabel POST → success
      .mockResolvedValueOnce({ ok: true } as Response);

    const board = createGitHubBoard(baseEnv, mockFetch);
    await board.addLabel('#42', 'clancy:build');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toContain('/issues/42/labels');
  });

  it('removeLabel removes a label from an issue', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValueOnce({
      ok: true,
    } as Response);

    const board = createGitHubBoard(baseEnv, mockFetch);
    await board.removeLabel('#42', 'clancy:build');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain(
      '/issues/42/labels/clancy%3Abuild',
    );
    expect(mockFetch.mock.calls[0][1]).toEqual(
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('removeLabel ignores 404 (label not on issue)', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const board = createGitHubBoard(baseEnv, mockFetch);
    await board.removeLabel('#42', 'missing');

    expect(warn).not.toHaveBeenCalled();
  });

  it('caches the username across multiple fetchTickets calls', async () => {
    const issues = [{ number: 1, title: 'T', body: '', labels: [] }];
    const mockFetch = vi
      .fn<Fetcher>()
      // First call: resolveUsername + fetchIssues
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ login: 'octocat' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(issues), { status: 200 }),
      )
      // Second call: only fetchIssues (username cached)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(issues), { status: 200 }),
      );

    const board = createGitHubBoard(baseEnv, mockFetch);
    await board.fetchTickets({});
    await board.fetchTickets({});

    // /user called once, /issues called twice = 3 total
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
