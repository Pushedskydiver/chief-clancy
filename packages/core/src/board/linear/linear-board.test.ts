import type { LinearEnv } from '../../schemas/index.js';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLinearBoard } from './linear-board.js';

/** Minimal valid LinearEnv for testing. */
function makeEnv(overrides?: Partial<LinearEnv>): LinearEnv {
  return {
    LINEAR_API_KEY: 'lin_test_key',
    LINEAR_TEAM_ID: 'team-uuid',
    ...overrides,
  };
}

// ── createLinearBoard ─────────────────────────────────────────────

describe('createLinearBoard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an object with all Board methods', () => {
    const board = createLinearBoard(makeEnv());

    expect(typeof board.ping).toBe('function');
    expect(typeof board.validateInputs).toBe('function');
    expect(typeof board.fetchTicket).toBe('function');
    expect(typeof board.fetchTickets).toBe('function');
    expect(typeof board.fetchBlockerStatus).toBe('function');
    expect(typeof board.fetchChildrenStatus).toBe('function');
    expect(typeof board.transitionTicket).toBe('function');
    expect(typeof board.ensureLabel).toBe('function');
    expect(typeof board.addLabel).toBe('function');
    expect(typeof board.removeLabel).toBe('function');
    expect(typeof board.sharedEnv).toBe('function');
  });

  it('validateInputs returns undefined for valid team ID', () => {
    const board = createLinearBoard(makeEnv());
    expect(board.validateInputs()).toBeUndefined();
  });

  it('validateInputs returns error for invalid team ID', () => {
    const board = createLinearBoard(makeEnv({ LINEAR_TEAM_ID: 'has spaces' }));
    expect(board.validateInputs()).toContain('invalid characters');
  });

  it('sharedEnv returns the original env object', () => {
    const env = makeEnv();
    const board = createLinearBoard(env);
    expect(board.sharedEnv()).toBe(env);
  });

  it('ping delegates to Linear API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { viewer: { id: 'user-123' } } }),
      } as Response),
    );

    const board = createLinearBoard(makeEnv());
    const result = await board.ping();
    expect(result.ok).toBe(true);
  });

  it('fetchTickets maps Linear issues to FetchedTicket shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              viewer: {
                assignedIssues: {
                  nodes: [
                    {
                      id: 'uuid-1',
                      identifier: 'ENG-42',
                      title: 'Fix bug',
                      description: 'Broken',
                      parent: { identifier: 'ENG-10' },
                      labels: { nodes: [{ name: 'bug' }] },
                    },
                  ],
                },
              },
            },
          }),
      } as Response),
    );

    const board = createLinearBoard(makeEnv());
    const tickets = await board.fetchTickets({});

    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toMatchObject({
      key: 'ENG-42',
      title: 'Fix bug',
      description: 'Broken',
      parentInfo: 'ENG-10',
      linearIssueId: 'uuid-1',
      issueId: 'uuid-1',
      labels: ['bug'],
      status: 'unstarted',
    });
  });

  it('fetchTicket returns first ticket', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              viewer: {
                assignedIssues: {
                  nodes: [
                    {
                      id: 'uuid-1',
                      identifier: 'ENG-1',
                      title: 'First',
                    },
                    {
                      id: 'uuid-2',
                      identifier: 'ENG-2',
                      title: 'Second',
                    },
                  ],
                },
              },
            },
          }),
      } as Response),
    );

    const board = createLinearBoard(makeEnv());
    const ticket = await board.fetchTicket({});
    expect(ticket?.key).toBe('ENG-1');
  });

  it('fetchTicket returns undefined when no tickets', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { viewer: { assignedIssues: { nodes: [] } } },
          }),
      } as Response),
    );

    const board = createLinearBoard(makeEnv());
    const ticket = await board.fetchTicket({});
    expect(ticket).toBeUndefined();
  });

  it('parentInfo defaults to "none" when no parent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              viewer: {
                assignedIssues: {
                  nodes: [
                    {
                      id: 'uuid-1',
                      identifier: 'ENG-1',
                      title: 'Solo',
                    },
                  ],
                },
              },
            },
          }),
      } as Response),
    );

    const board = createLinearBoard(makeEnv());
    const tickets = await board.fetchTickets({});
    expect(tickets[0]?.parentInfo).toBe('none');
  });

  it('fetchBlockerStatus returns false when no issueId', async () => {
    const board = createLinearBoard(makeEnv());
    const result = await board.fetchBlockerStatus({
      key: 'ENG-1',
      title: 'Test',
      description: '',
      parentInfo: 'none',
      blockers: 'None',
    });
    expect(result).toBe(false);
  });

  it('transitionTicket returns false when no linearIssueId', async () => {
    const board = createLinearBoard(makeEnv());
    const result = await board.transitionTicket(
      {
        key: 'ENG-1',
        title: 'Test',
        description: '',
        parentInfo: 'none',
        blockers: 'None',
      },
      'In Progress',
    );
    expect(result).toBe(false);
  });

  it('uses CLANCY_LABEL for default label filter', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { viewer: { assignedIssues: { nodes: [] } } },
        }),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const board = createLinearBoard(makeEnv({ CLANCY_LABEL: 'clancy:build' }));
    await board.fetchTickets({});

    const body = JSON.parse(
      (mockFetch.mock.calls[0]?.[1] as RequestInit).body as string,
    ) as { variables?: Record<string, unknown> };
    expect(body.variables).toHaveProperty('label', 'clancy:build');
  });

  it('buildLabel in opts overrides CLANCY_LABEL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { viewer: { assignedIssues: { nodes: [] } } },
        }),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const board = createLinearBoard(makeEnv({ CLANCY_LABEL: 'clancy:build' }));
    await board.fetchTickets({ buildLabel: 'custom:label' });

    const body = JSON.parse(
      (mockFetch.mock.calls[0]?.[1] as RequestInit).body as string,
    ) as { variables?: Record<string, unknown> };
    expect(body.variables).toHaveProperty('label', 'custom:label');
  });
});
