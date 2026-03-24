import { describe, expect, it } from 'vitest';

import {
  notionDatabaseQueryResponseSchema,
  notionPageSchema,
  notionUserResponseSchema,
} from './notion.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const page = {
  id: 'page-uuid-1',
  url: 'https://notion.so/page-uuid-1',
  properties: {
    Name: {
      type: 'title' as const,
      title: [{ plain_text: 'Implement auth' }],
    },
    Status: {
      type: 'status' as const,
      status: { id: 'status-1', name: 'In Progress', color: 'blue' },
    },
    Priority: {
      type: 'select' as const,
      select: { id: 'sel-1', name: 'High', color: 'red' },
    },
    Tags: {
      type: 'multi_select' as const,
      multi_select: [
        { id: 'ms-1', name: 'backend', color: 'green' },
        { id: 'ms-2', name: 'auth', color: 'purple' },
      ],
    },
    Assignee: {
      type: 'people' as const,
      people: [{ id: 'user-1', name: 'Alex' }],
    },
    Parent: {
      type: 'relation' as const,
      relation: [{ id: 'parent-page-uuid' }],
    },
    Description: {
      type: 'rich_text' as const,
      rich_text: [{ plain_text: 'Build the OAuth flow.' }],
    },
    Points: {
      type: 'number' as const,
    },
  },
};

const pageMinimal = {
  id: 'page-uuid-2',
  properties: {},
};

const databaseQueryResponse = {
  results: [page, pageMinimal],
  has_more: true,
  next_cursor: 'cursor-abc',
};

const userResponse = {
  id: 'bot-uuid-1',
  type: 'bot',
  name: 'Clancy Integration',
  avatar_url: 'https://notion.so/avatar.png',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('notionPageSchema', () => {
  it('validates a page with all property types', () => {
    const result = notionPageSchema.safeParse(page);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.id).toBe('page-uuid-1');
    expect(result.data.url).toBe('https://notion.so/page-uuid-1');
  });

  it('resolves title property', () => {
    const result = notionPageSchema.safeParse(page);
    if (!result.success) return;

    const title = result.data.properties['Name'];
    expect(title.type).toBe('title');
  });

  it('resolves status property', () => {
    const result = notionPageSchema.safeParse(page);
    if (!result.success) return;

    const status = result.data.properties['Status'];
    expect(status.type).toBe('status');
  });

  it('resolves multi-select property', () => {
    const result = notionPageSchema.safeParse(page);
    if (!result.success) return;

    const tags = result.data.properties['Tags'];
    expect(tags.type).toBe('multi_select');
  });

  it('accepts a minimal page with empty properties', () => {
    const result = notionPageSchema.safeParse(pageMinimal);

    expect(result.success).toBe(true);
  });

  it('accepts null status value', () => {
    const result = notionPageSchema.safeParse({
      id: 'page-3',
      properties: {
        Status: { type: 'status', status: null },
      },
    });

    expect(result.success).toBe(true);
  });

  it('accepts null select value', () => {
    const result = notionPageSchema.safeParse({
      id: 'page-4',
      properties: {
        Priority: { type: 'select', select: null },
      },
    });

    expect(result.success).toBe(true);
  });

  it('accepts people with null name', () => {
    const result = notionPageSchema.safeParse({
      id: 'page-5',
      properties: {
        Assignee: {
          type: 'people',
          people: [{ id: 'user-1', name: null }],
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it('falls back to generic type for unknown properties', () => {
    const result = notionPageSchema.safeParse({
      id: 'page-6',
      properties: {
        DueDate: { type: 'date' },
        Done: { type: 'checkbox' },
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects when id is missing', () => {
    const result = notionPageSchema.safeParse({
      properties: {},
    });

    expect(result.success).toBe(false);
  });

  it('rejects when properties is missing', () => {
    const result = notionPageSchema.safeParse({ id: 'page-7' });

    expect(result.success).toBe(false);
  });
});

describe('notionDatabaseQueryResponseSchema', () => {
  it('validates a full database query response', () => {
    const result = notionDatabaseQueryResponseSchema.safeParse(
      databaseQueryResponse,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.results).toHaveLength(2);
    expect(result.data.has_more).toBe(true);
    expect(result.data.next_cursor).toBe('cursor-abc');
  });

  it('accepts null next_cursor when has_more is false', () => {
    const result = notionDatabaseQueryResponseSchema.safeParse({
      results: [],
      has_more: false,
      next_cursor: null,
    });

    expect(result.success).toBe(true);
  });

  it('accepts without next_cursor field', () => {
    const result = notionDatabaseQueryResponseSchema.safeParse({
      results: [],
      has_more: false,
    });

    expect(result.success).toBe(true);
  });

  it('rejects when results is missing', () => {
    const result = notionDatabaseQueryResponseSchema.safeParse({
      has_more: false,
    });

    expect(result.success).toBe(false);
  });

  it('rejects when has_more is missing', () => {
    const result = notionDatabaseQueryResponseSchema.safeParse({
      results: [],
    });

    expect(result.success).toBe(false);
  });
});

describe('notionUserResponseSchema', () => {
  it('validates a full user response', () => {
    const result = notionUserResponseSchema.safeParse(userResponse);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.id).toBe('bot-uuid-1');
    expect(result.data.type).toBe('bot');
    expect(result.data.name).toBe('Clancy Integration');
  });

  it('accepts minimal user with only id', () => {
    const result = notionUserResponseSchema.safeParse({ id: 'bot-uuid-2' });

    expect(result.success).toBe(true);
  });

  it('accepts null name and avatar_url', () => {
    const result = notionUserResponseSchema.safeParse({
      id: 'bot-uuid-3',
      name: null,
      avatar_url: null,
    });

    expect(result.success).toBe(true);
  });

  it('rejects when id is missing', () => {
    const result = notionUserResponseSchema.safeParse({
      type: 'bot',
      name: 'No ID',
    });

    expect(result.success).toBe(false);
  });
});
