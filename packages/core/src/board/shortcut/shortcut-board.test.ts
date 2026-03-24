import type { ShortcutEnv } from '../../schemas/index.js';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createShortcutBoard } from './shortcut-board.js';

/** Minimal valid ShortcutEnv for testing. */
function makeEnv(overrides?: Partial<ShortcutEnv>): ShortcutEnv {
  return {
    SHORTCUT_API_TOKEN: 'tok_test',
    ...overrides,
  };
}

/** Stub fetch to return workflows + stories in sequence. */
function stubWorkflowsAndStories(
  stories: readonly unknown[] = [],
): ReturnType<typeof vi.fn> {
  return (
    vi
      .fn()
      // fetchWorkflows
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 1,
              name: 'Eng',
              states: [
                { id: 100, name: 'Backlog', type: 'unstarted' },
                { id: 101, name: 'In Progress', type: 'started' },
                { id: 102, name: 'Done', type: 'done' },
              ],
            },
          ]),
      } as Response)
      // fetchStories
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: stories }),
      } as Response)
  );
}

describe('createShortcutBoard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an object with all Board methods', () => {
    const board = createShortcutBoard(makeEnv());

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

  it('validateInputs returns undefined (no structural validation)', () => {
    const board = createShortcutBoard(makeEnv());
    expect(board.validateInputs()).toBeUndefined();
  });

  it('sharedEnv returns the original env object', () => {
    const env = makeEnv();
    const board = createShortcutBoard(env);
    expect(board.sharedEnv()).toBe(env);
  });

  it('fetchTickets maps stories to FetchedTicket shape', async () => {
    vi.stubGlobal(
      'fetch',
      stubWorkflowsAndStories([
        {
          id: 42,
          name: 'Fix bug',
          description: 'A bug',
          epic_id: 10,
          labels: [{ id: 1, name: 'bug' }],
        },
      ]),
    );

    const board = createShortcutBoard(makeEnv());
    const tickets = await board.fetchTickets({});

    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toMatchObject({
      key: 'sc-42',
      title: 'Fix bug',
      description: 'A bug',
      parentInfo: 'epic-10',
      issueId: '42',
      labels: ['bug'],
      status: 'unstarted',
    });
  });

  it('fetchTicket returns first ticket', async () => {
    vi.stubGlobal(
      'fetch',
      stubWorkflowsAndStories([
        { id: 1, name: 'First' },
        { id: 2, name: 'Second' },
      ]),
    );

    const board = createShortcutBoard(makeEnv());
    const ticket = await board.fetchTicket({});
    expect(ticket?.key).toBe('sc-1');
  });

  it('fetchTicket returns undefined when no stories', async () => {
    vi.stubGlobal('fetch', stubWorkflowsAndStories([]));

    const board = createShortcutBoard(makeEnv());
    const ticket = await board.fetchTicket({});
    expect(ticket).toBeUndefined();
  });

  it('parentInfo defaults to "none" when no epicId', async () => {
    vi.stubGlobal(
      'fetch',
      stubWorkflowsAndStories([{ id: 1, name: 'Story', epic_id: null }]),
    );

    const board = createShortcutBoard(makeEnv());
    const tickets = await board.fetchTickets({});
    expect(tickets[0]?.parentInfo).toBe('none');
  });

  it('fetchBlockerStatus returns false for invalid key', async () => {
    const board = createShortcutBoard(makeEnv());
    const result = await board.fetchBlockerStatus({
      key: 'invalid',
      title: 'Test',
      description: '',
      parentInfo: 'none',
      blockers: 'None',
    });
    expect(result).toBe(false);
  });

  it('transitionTicket returns false for invalid key', async () => {
    const board = createShortcutBoard(makeEnv());
    const result = await board.transitionTicket(
      {
        key: 'invalid',
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
    const mockFetch = stubWorkflowsAndStories([]);
    vi.stubGlobal('fetch', mockFetch);

    const board = createShortcutBoard(
      makeEnv({ CLANCY_LABEL: 'clancy:build' }),
    );
    await board.fetchTickets({});

    // Second call is fetchStories — check the search body
    const body = JSON.parse(
      (mockFetch.mock.calls[1]?.[1] as RequestInit).body as string,
    ) as Record<string, unknown>;
    expect(body.label_name).toBe('clancy:build');
  });

  it('buildLabel in opts overrides CLANCY_LABEL', async () => {
    const mockFetch = stubWorkflowsAndStories([]);
    vi.stubGlobal('fetch', mockFetch);

    const board = createShortcutBoard(
      makeEnv({ CLANCY_LABEL: 'clancy:build' }),
    );
    await board.fetchTickets({ buildLabel: 'custom:label' });

    const body = JSON.parse(
      (mockFetch.mock.calls[1]?.[1] as RequestInit).body as string,
    ) as Record<string, unknown>;
    expect(body.label_name).toBe('custom:label');
  });

  it('uses SHORTCUT_WORKFLOW for workflow scoping', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 1,
            name: 'Engineering',
            states: [{ id: 100, name: 'Backlog', type: 'unstarted' }],
          },
          {
            id: 2,
            name: 'Design',
            states: [{ id: 200, name: 'To Do', type: 'unstarted' }],
          },
        ]),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const board = createShortcutBoard(
      makeEnv({ SHORTCUT_WORKFLOW: 'Engineering' }),
    );
    await board.fetchTickets({});

    // The search body should use state 100 (Engineering), not 200 (Design)
    const body = JSON.parse(
      (mockFetch.mock.calls[1]?.[1] as RequestInit).body as string,
    ) as Record<string, unknown>;
    expect(body.workflow_state_id).toBe(100);
  });
});
