import type { Fetcher } from '~/c/shared/http/fetch-and-parse.js';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildAuthHeader,
  buildJql,
  extractAdfText,
  fetchTickets,
  isSafeJqlValue,
  isValidIssueKey,
  jiraHeaders,
  lookupTransitionId,
  pingJira,
  transitionIssue,
} from './api.js';

// ── jiraHeaders ────────────────────────────────────────────────────

describe('jiraHeaders', () => {
  it('returns Basic authorization', () => {
    const headers = jiraHeaders('base64str');
    expect(headers.Authorization).toBe('Basic base64str');
  });

  it('includes JSON accept header', () => {
    const headers = jiraHeaders('base64str');
    expect(headers.Accept).toBe('application/json');
  });
});

// ── buildAuthHeader ────────────────────────────────────────────────

describe('buildAuthHeader', () => {
  it('returns Base64-encoded user:token', () => {
    const auth = buildAuthHeader('user@example.com', 'api_token');
    const decoded = Buffer.from(auth, 'base64').toString();
    expect(decoded).toBe('user@example.com:api_token');
  });
});

// ── isSafeJqlValue ─────────────────────────────────────────────────

describe('isSafeJqlValue', () => {
  it('accepts alphanumeric values', () => {
    expect(isSafeJqlValue('To Do')).toBe(true);
  });

  it('accepts hyphens and underscores', () => {
    expect(isSafeJqlValue('clancy-build')).toBe(true);
  });

  it('rejects quotes', () => {
    expect(isSafeJqlValue('value"injection')).toBe(false);
  });

  it('rejects parentheses', () => {
    expect(isSafeJqlValue('fn()')).toBe(false);
  });
});

// ── isValidIssueKey ────────────────────────────────────────────────

describe('isValidIssueKey', () => {
  it('accepts standard issue keys', () => {
    expect(isValidIssueKey('PROJ-123')).toBe(true);
  });

  it('rejects lowercase keys', () => {
    expect(isValidIssueKey('proj-123')).toBe(false);
  });

  it('rejects missing number', () => {
    expect(isValidIssueKey('PROJ-')).toBe(false);
  });
});

// ── buildJql ───────────────────────────────────────────────────────

describe('buildJql', () => {
  it('builds basic query with project and status', () => {
    const jql = buildJql({ projectKey: 'PROJ', status: 'To Do' });
    expect(jql).toContain('project="PROJ"');
    expect(jql).toContain('status="To Do"');
    expect(jql).toContain('assignee=currentUser()');
    expect(jql).toContain('ORDER BY priority ASC');
  });

  it('includes sprint filter when set', () => {
    const jql = buildJql({
      projectKey: 'PROJ',
      status: 'To Do',
      sprint: 'current',
    });
    expect(jql).toContain('sprint in openSprints()');
  });

  it('includes label filter when set', () => {
    const jql = buildJql({
      projectKey: 'PROJ',
      status: 'To Do',
      label: 'clancy:build',
    });
    expect(jql).toContain('labels = "clancy:build"');
  });

  it('excludes HITL when set', () => {
    const jql = buildJql({
      projectKey: 'PROJ',
      status: 'To Do',
      excludeHitl: true,
    });
    expect(jql).toContain('labels != "clancy:hitl"');
  });

  it('throws on unsafe projectKey', () => {
    expect(() =>
      buildJql({ projectKey: 'PROJ"injection', status: 'To Do' }),
    ).toThrow('Unsafe JQL value');
  });

  it('throws on unsafe status', () => {
    expect(() => buildJql({ projectKey: 'PROJ', status: 'fn()' })).toThrow(
      'Unsafe JQL value',
    );
  });

  it('throws on unsafe label', () => {
    expect(() =>
      buildJql({ projectKey: 'PROJ', status: 'To Do', label: 'bad"label' }),
    ).toThrow('Unsafe JQL value');
  });
});

// ── extractAdfText ─────────────────────────────────────────────────

describe('extractAdfText', () => {
  it('extracts text from a simple ADF document', () => {
    const adf = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world' }],
        },
      ],
    };
    expect(extractAdfText(adf)).toContain('Hello world');
  });

  it('returns empty string for undefined', () => {
    expect(extractAdfText(undefined)).toBe('');
  });

  it('returns empty string for null', () => {
    expect(extractAdfText(null)).toBe('');
  });

  it('joins multiple text nodes with spaces', () => {
    const adf = {
      content: [{ text: 'First' }, { text: 'Second' }],
    };
    expect(extractAdfText(adf)).toBe('First Second');
  });
});

// ── pingJira ───────────────────────────────────────────────────────

describe('pingJira', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns ok on successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      }),
    );

    const result = await pingJira({
      baseUrl: 'https://example.atlassian.net',
      projectKey: 'PROJ',
      auth: 'auth',
    });
    expect(result).toEqual({ ok: true });
  });

  it('returns auth error on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      }),
    );

    const result = await pingJira({
      baseUrl: 'https://example.atlassian.net',
      projectKey: 'PROJ',
      auth: 'bad',
    });
    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'unknown',
        message: expect.stringContaining('auth failed'),
      },
    });
  });
});

// ── fetchTickets ───────────────────────────────────────────────────

describe('fetchTickets', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns mapped tickets from API response', async () => {
    const response = {
      issues: [
        {
          key: 'PROJ-42',
          fields: {
            summary: 'Fix bug',
            description: {
              content: [{ content: [{ text: 'Description text' }] }],
            },
            parent: { key: 'PROJ-10' },
            labels: ['bug'],
            issuelinks: [],
          },
        },
      ],
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(response), { status: 200 }),
    );

    const result = await fetchTickets({
      baseUrl: 'https://example.atlassian.net',
      auth: 'auth',
      projectKey: 'PROJ',
      status: 'To Do',
    });

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('PROJ-42');
    expect(result[0].provider).toBe('jira');
    expect(result[0].epicKey).toBe('PROJ-10');
    expect(result[0].labels).toEqual(['bug']);
  });

  it('extracts blocker keys from issuelinks', async () => {
    const response = {
      issues: [
        {
          key: 'PROJ-1',
          fields: {
            summary: 'Task',
            issuelinks: [
              {
                type: { name: 'Blocks' },
                inwardIssue: { key: 'PROJ-99' },
              },
            ],
            labels: [],
          },
        },
      ],
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(response), { status: 200 }),
    );

    const result = await fetchTickets({
      baseUrl: 'https://example.atlassian.net',
      auth: 'auth',
      projectKey: 'PROJ',
      status: 'To Do',
    });

    expect(result[0].blockers).toEqual(['PROJ-99']);
  });

  it('returns empty array on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await fetchTickets({
      baseUrl: 'https://example.atlassian.net',
      auth: 'auth',
      projectKey: 'PROJ',
      status: 'To Do',
    });

    expect(result).toEqual([]);
  });
});

// ── lookupTransitionId ─────────────────────────────────────────────

describe('lookupTransitionId', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns transition ID for matching status', async () => {
    const response = {
      transitions: [
        { id: '31', name: 'In Progress' },
        { id: '41', name: 'Done' },
      ],
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(response), { status: 200 }),
    );

    const id = await lookupTransitionId({
      baseUrl: 'https://example.atlassian.net',
      auth: 'auth',
      issueKey: 'PROJ-42',
      statusName: 'In Progress',
    });

    expect(id).toBe('31');
  });

  it('returns undefined for non-matching status', async () => {
    const response = { transitions: [{ id: '31', name: 'In Progress' }] };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(response), { status: 200 }),
    );

    const id = await lookupTransitionId({
      baseUrl: 'https://example.atlassian.net',
      auth: 'auth',
      issueKey: 'PROJ-42',
      statusName: 'No Such Status',
    });

    expect(id).toBeUndefined();
  });

  it('returns undefined for invalid issue key', async () => {
    const id = await lookupTransitionId({
      baseUrl: 'https://example.atlassian.net',
      auth: 'auth',
      issueKey: 'invalid',
      statusName: 'Done',
    });

    expect(id).toBeUndefined();
  });
});

// ── transitionIssue ────────────────────────────────────────────────

describe('transitionIssue', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true on successful transition', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      // lookupTransitionId
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ transitions: [{ id: '31', name: 'Done' }] }),
          { status: 200 },
        ),
      )
      // POST transition
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const result = await transitionIssue({
      baseUrl: 'https://example.atlassian.net',
      auth: 'auth',
      issueKey: 'PROJ-42',
      statusName: 'Done',
      fetcher: mockFetch,
    });

    expect(result).toBe(true);
  });

  it('returns false when transition not found', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue(
        new Response(JSON.stringify({ transitions: [] }), { status: 200 }),
      );
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await transitionIssue({
      baseUrl: 'https://example.atlassian.net',
      auth: 'auth',
      issueKey: 'PROJ-42',
      statusName: 'No Such Status',
      fetcher: mockFetch,
    });

    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    const mockFetch = vi.fn<Fetcher>().mockRejectedValue(new Error('network'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await transitionIssue({
      baseUrl: 'https://example.atlassian.net',
      auth: 'auth',
      issueKey: 'PROJ-42',
      statusName: 'Done',
      fetcher: mockFetch,
    });

    expect(result).toBe(false);
  });
});
