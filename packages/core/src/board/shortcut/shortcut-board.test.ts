import type { ShortcutEnv } from '~/c/schemas/env.js';
import type { Fetcher } from '~/c/shared/http/fetch-and-parse.js';
import type { Mock } from 'vitest';

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
): Mock<Fetcher> {
  return (
    vi
      .fn<Fetcher>()
      // fetchWorkflows
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
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
          { status: 200 },
        ),
      )
      // fetchStories
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: stories }),
      } as Response)
  );
}

describe('createShortcutBoard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
    const mockFetch = stubWorkflowsAndStories([
      {
        id: 42,
        name: 'Fix bug',
        description: 'A bug',
        epic_id: 10,
        workflow_state_id: 100,
        labels: [{ id: 1, name: 'bug' }],
      },
    ]);

    const board = createShortcutBoard(makeEnv(), mockFetch);
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

  it('fetchTickets respects limit parameter', async () => {
    const stories = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      name: `Story ${i + 1}`,
      workflow_state_id: 100,
    }));

    const mockFetch = stubWorkflowsAndStories(stories);
    const board = createShortcutBoard(makeEnv(), mockFetch);
    const tickets = await board.fetchTickets({ limit: 2 });

    expect(tickets).toHaveLength(2);
  });

  it('fetchTicket returns first ticket', async () => {
    const mockFetch = stubWorkflowsAndStories([
      { id: 1, name: 'First', workflow_state_id: 100 },
      { id: 2, name: 'Second', workflow_state_id: 100 },
    ]);

    const board = createShortcutBoard(makeEnv(), mockFetch);
    const ticket = await board.fetchTicket({});
    expect(ticket?.key).toBe('sc-1');
  });

  it('fetchTicket returns undefined when no stories', async () => {
    const mockFetch = stubWorkflowsAndStories([]);

    const board = createShortcutBoard(makeEnv(), mockFetch);
    const ticket = await board.fetchTicket({});
    expect(ticket).toBeUndefined();
  });

  it('parentInfo defaults to "none" when no epicId', async () => {
    const mockFetch = stubWorkflowsAndStories([
      { id: 1, name: 'Story', epic_id: null, workflow_state_id: 100 },
    ]);

    const board = createShortcutBoard(makeEnv(), mockFetch);
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

  it('fetchChildrenStatus returns undefined for invalid parentKey', async () => {
    const board = createShortcutBoard(makeEnv());
    const result = await board.fetchChildrenStatus('invalid');
    expect(result).toBeUndefined();
  });

  it('fetchChildrenStatus delegates to relations module', async () => {
    const mockFetch = stubWorkflowsAndStories([
      { id: 1, name: 'Warm', workflow_state_id: 100 },
    ]);
    // fetchChildrenByDescription (search stories — needs workflow state IDs)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            { id: 10, name: 'Child', workflow_state_id: 100 },
            { id: 11, name: 'Done Child', workflow_state_id: 102 },
          ],
        }),
    } as Response);

    const board = createShortcutBoard(makeEnv(), mockFetch);
    // First call warms the workflow cache
    await board.fetchTickets({});

    const result = await board.fetchChildrenStatus('sc-10');

    expect(result).toEqual({ total: 2, incomplete: 1 });
  });

  it('transitionTicket succeeds with valid key', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      // fetchWorkflows
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 1,
              name: 'Eng',
              states: [
                { id: 100, name: 'Backlog', type: 'unstarted' },
                { id: 101, name: 'In Progress', type: 'started' },
              ],
            },
          ]),
          { status: 200 },
        ),
      )
      // transitionStory PUT
      .mockResolvedValueOnce({ ok: true } as Response);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const board = createShortcutBoard(makeEnv(), mockFetch);
    const result = await board.transitionTicket(
      {
        key: 'sc-42',
        title: 'Test',
        description: '',
        parentInfo: 'none',
        blockers: 'None',
      },
      'In Progress',
    );
    expect(result).toBe(true);
  });

  it('uses CLANCY_LABEL for default label filter', async () => {
    const mockFetch = stubWorkflowsAndStories([]);

    const board = createShortcutBoard(
      makeEnv({ CLANCY_LABEL: 'clancy:build' }),
      mockFetch,
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

    const board = createShortcutBoard(
      makeEnv({ CLANCY_LABEL: 'clancy:build' }),
      mockFetch,
    );
    await board.fetchTickets({ buildLabel: 'custom:label' });

    const body = JSON.parse(
      (mockFetch.mock.calls[1]?.[1] as RequestInit).body as string,
    ) as Record<string, unknown>;
    expect(body.label_name).toBe('custom:label');
  });

  it('does not send workflow_state_id in search body', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue(
      new Response(
        JSON.stringify([
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
        { status: 200 },
      ),
    );

    const board = createShortcutBoard(
      makeEnv({ SHORTCUT_WORKFLOW: 'Engineering' }),
      mockFetch,
    );
    await board.fetchTickets({});

    // Shortcut removed workflow_state_id from /stories/search (2026).
    // State filtering is now client-side — body should not include it.
    const body = JSON.parse(
      (mockFetch.mock.calls[1]?.[1] as RequestInit).body as string,
    ) as Record<string, unknown>;
    expect(body).not.toHaveProperty('workflow_state_id');
  });
});
