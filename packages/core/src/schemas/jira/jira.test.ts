import { describe, expect, it } from 'vitest';

import {
  jiraIssueLabelsResponseSchema,
  jiraIssueLinksResponseSchema,
  jiraSearchResponseSchema,
  jiraTransitionsResponseSchema,
} from './jira.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const searchResponse = {
  total: 2,
  isLast: true,
  issues: [
    {
      key: 'PROJ-1',
      fields: {
        summary: 'Implement login page',
        description: { type: 'doc', content: [] },
        issuelinks: [
          {
            type: { name: 'Blocks' },
            inwardIssue: { key: 'PROJ-2' },
          },
        ],
        parent: { key: 'PROJ-100' },
        customfield_10014: 'PROJ-100',
        labels: ['frontend', 'auth'],
      },
    },
    {
      key: 'PROJ-3',
      fields: {
        summary: 'Fix CSS bug',
      },
    },
  ],
};

const transitionsResponse = {
  transitions: [
    { id: '11', name: 'To Do' },
    { id: '21', name: 'In Progress' },
    { id: '31', name: 'Done' },
  ],
};

const issueLinksResponse = {
  fields: {
    issuelinks: [
      {
        type: { name: 'Blocks' },
        inwardIssue: {
          key: 'PROJ-5',
          fields: {
            status: {
              statusCategory: { key: 'done' },
            },
          },
        },
      },
    ],
  },
};

const issueLabelsResponse = {
  fields: {
    labels: ['clancy', 'frontend'],
  },
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('jiraSearchResponseSchema', () => {
  it('validates a full search response', () => {
    const result = jiraSearchResponseSchema.safeParse(searchResponse);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.issues).toHaveLength(2);
    expect(result.data.issues[0].key).toBe('PROJ-1');
    expect(result.data.issues[0].fields.summary).toBe('Implement login page');
    expect(result.data.issues[0].fields.labels).toEqual(['frontend', 'auth']);
  });

  it('accepts minimal issue with only required fields', () => {
    const minimal = {
      issues: [{ key: 'PROJ-1', fields: { summary: 'Minimal' } }],
    };
    const result = jiraSearchResponseSchema.safeParse(minimal);

    expect(result.success).toBe(true);
  });

  it('rejects when issues array is missing', () => {
    const result = jiraSearchResponseSchema.safeParse({ total: 0 });

    expect(result.success).toBe(false);
  });

  it('rejects when issue key is missing', () => {
    const result = jiraSearchResponseSchema.safeParse({
      issues: [{ fields: { summary: 'No key' } }],
    });

    expect(result.success).toBe(false);
  });
});

describe('jiraTransitionsResponseSchema', () => {
  it('validates a transitions response', () => {
    const result = jiraTransitionsResponseSchema.safeParse(transitionsResponse);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.transitions).toHaveLength(3);
    expect(result.data.transitions[0].name).toBe('To Do');
  });

  it('accepts empty transitions array', () => {
    const result = jiraTransitionsResponseSchema.safeParse({
      transitions: [],
    });

    expect(result.success).toBe(true);
  });

  it('rejects when transition id is missing', () => {
    const result = jiraTransitionsResponseSchema.safeParse({
      transitions: [{ name: 'No ID' }],
    });

    expect(result.success).toBe(false);
  });
});

describe('jiraIssueLinksResponseSchema', () => {
  it('parses successfully', () => {
    const result = jiraIssueLinksResponseSchema.safeParse(issueLinksResponse);

    expect(result.success).toBe(true);
  });

  it('exposes blocker key and status category', () => {
    const result = jiraIssueLinksResponseSchema.safeParse(issueLinksResponse);
    if (!result.success) return;

    // Fixture is fully populated — non-null assertions are safe here
    const link = result.data.fields!.issuelinks![0];
    const inward = link.inwardIssue!;

    expect(inward.key).toBe('PROJ-5');
    expect(inward.fields!.status!.statusCategory!.key).toBe('done');
  });

  it('accepts empty fields', () => {
    const result = jiraIssueLinksResponseSchema.safeParse({});

    expect(result.success).toBe(true);
  });
});

describe('jiraIssueLabelsResponseSchema', () => {
  it('validates an issue labels response', () => {
    const result = jiraIssueLabelsResponseSchema.safeParse(issueLabelsResponse);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.fields?.labels).toEqual(['clancy', 'frontend']);
  });

  it('accepts empty fields', () => {
    const result = jiraIssueLabelsResponseSchema.safeParse({});

    expect(result.success).toBe(true);
  });
});
