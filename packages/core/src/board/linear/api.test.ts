import type { Fetcher } from '~/c/shared/http/fetch-and-parse.js';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchIssues,
  isValidTeamId,
  linearGraphql,
  linearHeaders,
  pingLinear,
} from './api.js';

// ── linearHeaders ─────────────────────────────────────────────────

describe('linearHeaders', () => {
  it('returns raw API key without Bearer prefix', () => {
    const headers = linearHeaders('lin_api_abc123');
    expect(headers.Authorization).toBe('lin_api_abc123');
  });

  it('includes JSON content-type', () => {
    const headers = linearHeaders('key');
    expect(headers['Content-Type']).toBe('application/json');
  });
});

// ── isValidTeamId ─────────────────────────────────────────────────

describe('isValidTeamId', () => {
  it('accepts alphanumeric IDs', () => {
    expect(isValidTeamId('abc123')).toBe(true);
  });

  it('accepts UUIDs with hyphens', () => {
    expect(isValidTeamId('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
  });

  it('accepts underscores', () => {
    expect(isValidTeamId('team_id_1')).toBe(true);
  });

  it('rejects spaces', () => {
    expect(isValidTeamId('team id')).toBe(false);
  });

  it('rejects special characters', () => {
    expect(isValidTeamId('team;drop')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidTeamId('')).toBe(false);
  });
});

// ── linearGraphql ─────────────────────────────────────────────────

describe('linearGraphql', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends POST to Linear GraphQL endpoint', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { viewer: { id: '123' } } }),
    } as Response);

    await linearGraphql({
      apiKey: 'api_key',
      query: '{ viewer { id } }',
      fetcher: mockFetch,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.linear.app/graphql',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('passes API key directly in Authorization header', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: {} }),
    } as Response);

    await linearGraphql({
      apiKey: 'lin_api_key',
      query: '{ viewer { id } }',
      fetcher: mockFetch,
    });

    const init = mockFetch.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('lin_api_key');
  });

  it('includes query and variables in body', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: {} }),
    } as Response);

    await linearGraphql({
      apiKey: 'key',
      query: 'query($id: ID!) { issue(id: $id) { id } }',
      variables: { id: '123' },
      fetcher: mockFetch,
    });

    const init = mockFetch.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.query).toBe('query($id: ID!) { issue(id: $id) { id } }');
    expect(body.variables).toEqual({ id: '123' });
  });

  it('returns parsed JSON on success', async () => {
    const expected = { data: { viewer: { id: '42' } } };
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(expected),
    } as Response);

    const result = await linearGraphql({
      apiKey: 'key',
      query: '{ viewer { id } }',
      fetcher: mockFetch,
    });
    expect(result).toEqual(expected);
  });

  it('returns undefined on network error', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockRejectedValue(new Error('network down'));

    const result = await linearGraphql({
      apiKey: 'key',
      query: '{ viewer { id } }',
      fetcher: mockFetch,
    });
    expect(result).toBeUndefined();
  });

  it('returns undefined on non-OK response', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue({ ok: false, status: 500 } as Response);

    const result = await linearGraphql({
      apiKey: 'key',
      query: '{ viewer { id } }',
      fetcher: mockFetch,
    });
    expect(result).toBeUndefined();
  });

  it('returns undefined on invalid JSON', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error('bad json')),
    } as Response);

    const result = await linearGraphql({
      apiKey: 'key',
      query: '{ viewer { id } }',
      fetcher: mockFetch,
    });
    expect(result).toBeUndefined();
  });
});

// ── pingLinear ────────────────────────────────────────────────────

describe('pingLinear', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ok on valid viewer response', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { viewer: { id: 'user-uuid' } } }),
    } as Response);

    const result = await pingLinear('key', mockFetch);
    expect(result).toEqual({ ok: true });
  });

  it('returns auth error on 401', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue({ ok: false, status: 401 } as Response);

    const result = await pingLinear('key', mockFetch);
    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'unknown',
        message: expect.stringContaining('auth failed'),
      },
    });
  });

  it('returns auth error on 403', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue({ ok: false, status: 403 } as Response);

    const result = await pingLinear('key', mockFetch);
    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'unknown',
        message: expect.stringContaining('auth failed'),
      },
    });
  });

  it('returns generic error on other HTTP codes', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue({ ok: false, status: 500 } as Response);

    const result = await pingLinear('key', mockFetch);
    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'unknown', message: expect.stringContaining('500') },
    });
  });

  it('returns network error on fetch failure', async () => {
    const mockFetch = vi.fn<Fetcher>().mockRejectedValue(new Error('offline'));

    const result = await pingLinear('key', mockFetch);
    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'unknown', message: expect.stringContaining('network') },
    });
  });

  it('returns auth error when viewer ID is missing', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: {} }),
    } as Response);

    const result = await pingLinear('key', mockFetch);
    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'unknown',
        message: expect.stringContaining('auth failed'),
      },
    });
  });
});

// ── fetchIssues ───────────────────────────────────────────────────

describe('fetchIssues', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns mapped tickets on success', async () => {
    const graphqlResponse = {
      data: {
        viewer: {
          assignedIssues: {
            nodes: [
              {
                id: 'uuid-1',
                identifier: 'ENG-42',
                title: 'Fix login bug',
                description: 'Users cannot login',
                parent: { identifier: 'ENG-10', title: 'Auth Epic' },
                labels: { nodes: [{ name: 'bug' }] },
              },
            ],
          },
        },
      },
    };

    const mockFetch = vi.fn<Fetcher>().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(graphqlResponse),
    } as Response);

    const tickets = await fetchIssues({
      apiKey: 'key',
      teamId: 'team-1',
      fetcher: mockFetch,
    });

    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toEqual({
      key: 'ENG-42',
      title: 'Fix login bug',
      description: 'Users cannot login',
      provider: 'linear',
      issueId: 'uuid-1',
      parentIdentifier: 'ENG-10',
      labels: ['bug'],
    });
  });

  it('returns empty array on API failure', async () => {
    const mockFetch = vi
      .fn<Fetcher>()
      .mockResolvedValue({ ok: false, status: 500 } as Response);

    const tickets = await fetchIssues({
      apiKey: 'key',
      teamId: 'team-1',
      fetcher: mockFetch,
    });

    expect(tickets).toEqual([]);
  });

  it('returns empty array when no issues found', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { viewer: { assignedIssues: { nodes: [] } } },
        }),
    } as Response);

    const tickets = await fetchIssues({
      apiKey: 'key',
      teamId: 'team-1',
      fetcher: mockFetch,
    });

    expect(tickets).toEqual([]);
  });

  it('includes label filter in query when provided', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { viewer: { assignedIssues: { nodes: [] } } },
        }),
    } as Response);

    await fetchIssues({
      apiKey: 'key',
      teamId: 'team-1',
      label: 'clancy:build',
      fetcher: mockFetch,
    });

    const body = JSON.parse(
      (mockFetch.mock.calls[0]?.[1] as RequestInit).body as string,
    ) as { variables?: Record<string, unknown> };
    expect(body.variables).toHaveProperty('label', 'clancy:build');
  });

  it('filters out HITL issues when excludeHitl is true', async () => {
    const graphqlResponse = {
      data: {
        viewer: {
          assignedIssues: {
            nodes: [
              {
                id: 'uuid-1',
                identifier: 'ENG-1',
                title: 'Normal',
                labels: { nodes: [{ name: 'bug' }] },
              },
              {
                id: 'uuid-2',
                identifier: 'ENG-2',
                title: 'HITL issue',
                labels: { nodes: [{ name: 'clancy:hitl' }] },
              },
            ],
          },
        },
      },
    };

    const mockFetch = vi.fn<Fetcher>().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(graphqlResponse),
    } as Response);

    const tickets = await fetchIssues({
      apiKey: 'key',
      teamId: 'team-1',
      excludeHitl: true,
      fetcher: mockFetch,
    });

    expect(tickets).toHaveLength(1);
    expect(tickets[0]?.key).toBe('ENG-1');
  });

  it('handles null description gracefully', async () => {
    const mockFetch = vi.fn<Fetcher>().mockResolvedValue({
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
                    title: 'No desc',
                    description: null,
                  },
                ],
              },
            },
          },
        }),
    } as Response);

    const tickets = await fetchIssues({
      apiKey: 'key',
      teamId: 'team-1',
      fetcher: mockFetch,
    });

    expect(tickets[0]?.description).toBe('');
  });
});
