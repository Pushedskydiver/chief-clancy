import type { JiraEnv } from '~/c/schemas/index.js';
import type { Fetcher } from '~/c/shared/http/index.js';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createJiraBoard } from './jira-board.js';

const baseEnv: JiraEnv = {
  JIRA_BASE_URL: 'https://example.atlassian.net',
  JIRA_USER: 'user@example.com',
  JIRA_API_TOKEN: 'api_token',
  JIRA_PROJECT_KEY: 'PROJ',
};

describe('createJiraBoard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a Board object with all required methods', () => {
    const board = createJiraBoard(baseEnv);

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

  it('validateInputs returns undefined for valid config', () => {
    const board = createJiraBoard(baseEnv);
    expect(board.validateInputs()).toBeUndefined();
  });

  it('validateInputs returns error for unsafe project key', () => {
    const board = createJiraBoard({
      ...baseEnv,
      JIRA_PROJECT_KEY: 'PROJ"injection',
    });
    expect(board.validateInputs()).toContain('JIRA_PROJECT_KEY');
  });

  it('sharedEnv returns the env object', () => {
    const board = createJiraBoard(baseEnv);
    expect(board.sharedEnv()).toBe(baseEnv);
  });

  it('ensureLabel is a no-op', async () => {
    const board = createJiraBoard(baseEnv);
    await board.ensureLabel('any-label');
    // Should not throw or call fetch
  });

  it('fetchTickets maps Jira issues to FetchedTicket shape', async () => {
    const response = {
      issues: [
        {
          key: 'PROJ-42',
          fields: {
            summary: 'Fix bug',
            description: null,
            parent: { key: 'PROJ-10' },
            labels: ['bug'],
            issuelinks: [
              {
                type: { name: 'Blocks' },
                inwardIssue: { key: 'PROJ-99' },
              },
            ],
          },
        },
      ],
    };
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(
        new Response(JSON.stringify(response), { status: 200 }),
      );

    const board = createJiraBoard(baseEnv, mockFetch);
    const tickets = await board.fetchTickets({});

    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toEqual({
      key: 'PROJ-42',
      title: 'Fix bug',
      description: '',
      parentInfo: 'PROJ-10',
      blockers: 'Blocked by: PROJ-99',
      issueId: 'PROJ-42',
      labels: ['bug'],
      status: 'To Do',
    });
  });

  it('fetchTickets forwards limit as maxResults in JQL request', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(
        new Response(JSON.stringify({ issues: [] }), { status: 200 }),
      );

    const board = createJiraBoard(baseEnv, mockFetch);
    await board.fetchTickets({ limit: 2 });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as {
      maxResults: number;
    };
    expect(body.maxResults).toBe(2);
  });

  it('fetchTicket returns the first ticket', async () => {
    const response = {
      issues: [
        {
          key: 'PROJ-1',
          fields: {
            summary: 'First',
            labels: [],
            issuelinks: [],
          },
        },
      ],
    };
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(
        new Response(JSON.stringify(response), { status: 200 }),
      );

    const board = createJiraBoard(baseEnv, mockFetch);
    const ticket = await board.fetchTicket({});

    expect(ticket?.key).toBe('PROJ-1');
  });

  it('fetchTicket returns undefined when no issues', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(
        new Response(JSON.stringify({ issues: [] }), { status: 200 }),
      );

    const board = createJiraBoard(baseEnv, mockFetch);
    const ticket = await board.fetchTicket({});

    expect(ticket).toBeUndefined();
  });

  it('fetchBlockerStatus delegates to relations module', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue(
      new Response(
        JSON.stringify({
          fields: {
            issuelinks: [
              {
                type: { name: 'Blocks' },
                inwardIssue: {
                  key: 'PROJ-99',
                  fields: {
                    status: { statusCategory: { key: 'indeterminate' } },
                  },
                },
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const board = createJiraBoard(baseEnv, mockFetch);
    const result = await board.fetchBlockerStatus({
      key: 'PROJ-42',
      title: '',
      description: '',
      parentInfo: 'none',
      blockers: 'None',
    });
    expect(result).toBe(true);
  });

  it('fetchChildrenStatus delegates to relations module', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ total: 2 }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ total: 1 }), { status: 200 }),
      );

    const board = createJiraBoard(baseEnv, mockFetch);
    const result = await board.fetchChildrenStatus('PROJ-10');

    expect(result).toEqual({ total: 2, incomplete: 1 });
  });

  it('addLabel delegates to label module', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      // GET labels
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ fields: { labels: ['existing'] } }), {
          status: 200,
        }),
      )
      // PUT labels
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const board = createJiraBoard(baseEnv, mockFetch);
    await board.addLabel('PROJ-42', 'new-label');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][1]).toEqual(
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('removeLabel delegates to label module', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      // GET labels
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ fields: { labels: ['bug', 'remove-me'] } }),
          { status: 200 },
        ),
      )
      // PUT labels
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const board = createJiraBoard(baseEnv, mockFetch);
    await board.removeLabel('PROJ-42', 'remove-me');

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('uses custom CLANCY_JQL_STATUS for status field', async () => {
    const response = {
      issues: [
        {
          key: 'PROJ-1',
          fields: { summary: 'Task', labels: [], issuelinks: [] },
        },
      ],
    };
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(
        new Response(JSON.stringify(response), { status: 200 }),
      );

    const board = createJiraBoard(
      {
        ...baseEnv,
        CLANCY_JQL_STATUS: 'In Progress',
      },
      mockFetch,
    );
    const tickets = await board.fetchTickets({});

    expect(tickets[0].status).toBe('In Progress');
  });

  it('transitionTicket logs on success', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            transitions: [{ id: '31', name: 'Done' }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    const board = createJiraBoard(baseEnv, mockFetch);
    const result = await board.transitionTicket(
      {
        key: 'PROJ-42',
        title: 'T',
        description: '',
        parentInfo: 'none',
        blockers: 'None',
      },
      'Done',
    );

    expect(result).toBe(true);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('Transitioned to Done'),
    );
  });
});
