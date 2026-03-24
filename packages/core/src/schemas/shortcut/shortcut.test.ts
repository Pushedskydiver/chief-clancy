import { describe, expect, it } from 'vitest';

import {
  shortcutEpicStoriesResponseSchema,
  shortcutLabelCreateResponseSchema,
  shortcutLabelsResponseSchema,
  shortcutMemberInfoResponseSchema,
  shortcutStoryDetailResponseSchema,
  shortcutStorySearchResponseSchema,
  shortcutStoryUpdateResponseSchema,
  shortcutWorkflowsResponseSchema,
} from './shortcut.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const story = {
  id: 123,
  name: 'Implement login page',
  description: 'Build the OAuth login page.',
  story_type: 'feature',
  blocked: false,
  story_links: [
    { verb: 'blocks', subject_id: 123, object_id: 456 },
    { verb: 'is blocked by', subject_id: 789, object_id: 123 },
  ],
  label_ids: [1, 2],
  labels: [
    { id: 1, name: 'frontend' },
    { id: 2, name: 'auth' },
  ],
  epic_id: 10,
  workflow_state_id: 500_001,
  owner_ids: ['user-uuid-1'],
};

const storyMinimal = {
  id: 456,
  name: 'Minimal story',
};

const searchResponse = {
  data: [story, storyMinimal],
  next: '/stories/search?next=abc123',
  total: 2,
};

const workflowsResponse = [
  {
    id: 1,
    name: 'Engineering',
    states: [
      { id: 500_001, name: 'Unstarted', type: 'unstarted' },
      { id: 500_002, name: 'In Progress', type: 'started' },
      { id: 500_003, name: 'Done', type: 'done' },
    ],
  },
];

const labelsResponse = [
  { id: 1, name: 'bug' },
  { id: 2, name: 'feature' },
];

const memberInfoResponse = {
  id: 'member-uuid-1',
  mention_name: 'alex',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('shortcutStorySearchResponseSchema', () => {
  it('validates a full search response', () => {
    const result = shortcutStorySearchResponseSchema.safeParse(searchResponse);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.data).toHaveLength(2);
    expect(result.data.data[0].name).toBe('Implement login page');
    expect(result.data.next).toBe('/stories/search?next=abc123');
  });

  it('accepts minimal search with no pagination', () => {
    const result = shortcutStorySearchResponseSchema.safeParse({
      data: [storyMinimal],
    });

    expect(result.success).toBe(true);
  });

  it('accepts null next cursor', () => {
    const result = shortcutStorySearchResponseSchema.safeParse({
      data: [],
      next: null,
    });

    expect(result.success).toBe(true);
  });

  it('rejects when data array is missing', () => {
    const result = shortcutStorySearchResponseSchema.safeParse({
      total: 0,
    });

    expect(result.success).toBe(false);
  });
});

describe('shortcutStoryDetailResponseSchema', () => {
  it('validates a full story detail', () => {
    const result = shortcutStoryDetailResponseSchema.safeParse(story);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.id).toBe(123);
    expect(result.data.story_links).toHaveLength(2);
    expect(result.data.labels?.[0].name).toBe('frontend');
  });

  it('accepts a minimal story', () => {
    const result = shortcutStoryDetailResponseSchema.safeParse(storyMinimal);

    expect(result.success).toBe(true);
  });

  it('accepts null description and epic_id', () => {
    const result = shortcutStoryDetailResponseSchema.safeParse({
      ...storyMinimal,
      description: null,
      epic_id: null,
    });

    expect(result.success).toBe(true);
  });

  it('rejects when id is missing', () => {
    const result = shortcutStoryDetailResponseSchema.safeParse({
      name: 'No ID',
    });

    expect(result.success).toBe(false);
  });
});

describe('shortcutWorkflowsResponseSchema', () => {
  it('validates an array of workflows', () => {
    const result = shortcutWorkflowsResponseSchema.safeParse(workflowsResponse);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toHaveLength(1);
    expect(result.data[0].states).toHaveLength(3);
    expect(result.data[0].states[0].type).toBe('unstarted');
  });

  it('accepts an empty array', () => {
    const result = shortcutWorkflowsResponseSchema.safeParse([]);

    expect(result.success).toBe(true);
  });

  it('rejects when state type is missing', () => {
    const result = shortcutWorkflowsResponseSchema.safeParse([
      { id: 1, name: 'Wf', states: [{ id: 1, name: 'S' }] },
    ]);

    expect(result.success).toBe(false);
  });
});

describe('shortcutLabelsResponseSchema', () => {
  it('validates an array of labels', () => {
    const result = shortcutLabelsResponseSchema.safeParse(labelsResponse);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toHaveLength(2);
    expect(result.data[0].name).toBe('bug');
  });

  it('accepts an empty array', () => {
    const result = shortcutLabelsResponseSchema.safeParse([]);

    expect(result.success).toBe(true);
  });
});

describe('shortcutLabelCreateResponseSchema', () => {
  it('validates a created label', () => {
    const result = shortcutLabelCreateResponseSchema.safeParse({
      id: 99,
      name: 'clancy',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.name).toBe('clancy');
  });

  it('rejects when name is missing', () => {
    const result = shortcutLabelCreateResponseSchema.safeParse({ id: 99 });

    expect(result.success).toBe(false);
  });
});

describe('shortcutEpicStoriesResponseSchema', () => {
  it('validates an array of stories', () => {
    const result = shortcutEpicStoriesResponseSchema.safeParse([
      story,
      storyMinimal,
    ]);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toHaveLength(2);
  });
});

describe('shortcutMemberInfoResponseSchema', () => {
  it('validates a member info response', () => {
    const result =
      shortcutMemberInfoResponseSchema.safeParse(memberInfoResponse);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.id).toBe('member-uuid-1');
    expect(result.data.mention_name).toBe('alex');
  });

  it('accepts without optional mention_name', () => {
    const result = shortcutMemberInfoResponseSchema.safeParse({
      id: 'member-uuid-2',
    });

    expect(result.success).toBe(true);
  });

  it('rejects when id is missing', () => {
    const result = shortcutMemberInfoResponseSchema.safeParse({
      mention_name: 'alex',
    });

    expect(result.success).toBe(false);
  });
});

describe('shortcutStoryUpdateResponseSchema', () => {
  it('validates an updated story', () => {
    const result = shortcutStoryUpdateResponseSchema.safeParse(story);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.id).toBe(123);
  });
});
