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
    vi.unstubAllGlobals();
  });

  it('sends POST to Linear GraphQL endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { viewer: { id: '123' } } }),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    await linearGraphql('api_key', '{ viewer { id } }');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.linear.app/graphql',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('passes API key directly in Authorization header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: {} }),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    await linearGraphql('lin_api_key', '{ viewer { id } }');

    const init = mockFetch.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('lin_api_key');
  });

  it('includes query and variables in body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: {} }),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    await linearGraphql('key', 'query($id: ID!) { issue(id: $id) { id } }', {
      id: '123',
    });

    const init = mockFetch.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.query).toBe('query($id: ID!) { issue(id: $id) { id } }');
    expect(body.variables).toEqual({ id: '123' });
  });

  it('returns parsed JSON on success', async () => {
    const expected = { data: { viewer: { id: '42' } } };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(expected),
      } as Response),
    );

    const result = await linearGraphql('key', '{ viewer { id } }');
    expect(result).toEqual(expected);
  });

  it('returns undefined on network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );

    const result = await linearGraphql('key', '{ viewer { id } }');
    expect(result).toBeUndefined();
  });

  it('returns undefined on non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response),
    );

    const result = await linearGraphql('key', '{ viewer { id } }');
    expect(result).toBeUndefined();
  });

  it('returns undefined on invalid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('bad json')),
      } as Response),
    );

    const result = await linearGraphql('key', '{ viewer { id } }');
    expect(result).toBeUndefined();
  });
});

// ── pingLinear ────────────────────────────────────────────────────

describe('pingLinear', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns ok on valid viewer response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { viewer: { id: 'user-uuid' } } }),
      } as Response),
    );

    const result = await pingLinear('key');
    expect(result).toEqual({ ok: true });
  });

  it('returns auth error on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response),
    );

    const result = await pingLinear('key');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('auth failed');
  });

  it('returns auth error on 403', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response),
    );

    const result = await pingLinear('key');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('auth failed');
  });

  it('returns generic error on other HTTP codes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response),
    );

    const result = await pingLinear('key');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('500');
  });

  it('returns network error on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const result = await pingLinear('key');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('network');
  });

  it('returns auth error when viewer ID is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      } as Response),
    );

    const result = await pingLinear('key');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('auth failed');
  });
});

// ── fetchIssues ───────────────────────────────────────────────────

describe('fetchIssues', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(graphqlResponse),
      } as Response),
    );

    const tickets = await fetchIssues({
      apiKey: 'key',
      teamId: 'team-1',
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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response),
    );

    const tickets = await fetchIssues({
      apiKey: 'key',
      teamId: 'team-1',
    });

    expect(tickets).toEqual([]);
  });

  it('returns empty array when no issues found', async () => {
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

    const tickets = await fetchIssues({
      apiKey: 'key',
      teamId: 'team-1',
    });

    expect(tickets).toEqual([]);
  });

  it('includes label filter in query when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { viewer: { assignedIssues: { nodes: [] } } },
        }),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    await fetchIssues({
      apiKey: 'key',
      teamId: 'team-1',
      label: 'clancy:build',
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

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(graphqlResponse),
      } as Response),
    );

    const tickets = await fetchIssues({
      apiKey: 'key',
      teamId: 'team-1',
      excludeHitl: true,
    });

    expect(tickets).toHaveLength(1);
    expect(tickets[0]?.key).toBe('ENG-1');
  });

  it('handles null description gracefully', async () => {
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
                      title: 'No desc',
                      description: null,
                    },
                  ],
                },
              },
            },
          }),
      } as Response),
    );

    const tickets = await fetchIssues({
      apiKey: 'key',
      teamId: 'team-1',
    });

    expect(tickets[0]?.description).toBe('');
  });
});
