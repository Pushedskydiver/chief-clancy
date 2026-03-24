import { describe, expect, it } from 'vitest';

import {
  azdoProjectResponseSchema,
  azdoWiqlLinkResponseSchema,
  azdoWiqlResponseSchema,
  azdoWorkItemsBatchResponseSchema,
  azdoWorkItemSchema,
} from './azdo.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const wiqlResponse = {
  workItems: [
    {
      id: 101,
      url: 'https://dev.azure.com/myorg/myproj/_apis/wit/workItems/101',
    },
    { id: 102 },
  ],
};

const workItem = {
  id: 101,
  fields: {
    'System.Title': 'Implement auth flow',
    'System.Description': '<p>Build the OAuth flow.</p>',
    'System.State': 'Active',
    'System.Tags': 'backend; auth',
    'System.AssignedTo': {
      displayName: 'Alex',
      uniqueName: 'alex@example.com',
    },
    'System.WorkItemType': 'User Story',
  },
  relations: [
    {
      rel: 'System.LinkTypes.Hierarchy-Reverse',
      url: 'https://dev.azure.com/myorg/myproj/_apis/wit/workItems/50',
      attributes: { name: 'Parent' },
    },
  ],
};

const workItemMinimal = {
  id: 102,
  fields: {},
};

const batchResponse = {
  value: [workItem, workItemMinimal],
  count: 2,
};

const projectResponse = {
  id: 'proj-uuid-123',
  name: 'MyProject',
  state: 'wellFormed',
};

const wiqlLinkResponse = {
  workItemRelations: [
    {
      source: {
        id: 50,
        url: 'https://dev.azure.com/myorg/_apis/wit/workItems/50',
      },
      target: {
        id: 101,
        url: 'https://dev.azure.com/myorg/_apis/wit/workItems/101',
      },
    },
    {
      source: null,
      target: { id: 50 },
    },
  ],
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('azdoWiqlResponseSchema', () => {
  it('validates a WIQL response', () => {
    const result = azdoWiqlResponseSchema.safeParse(wiqlResponse);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.workItems).toHaveLength(2);
    expect(result.data.workItems[0].id).toBe(101);
  });

  it('accepts empty work items array', () => {
    const result = azdoWiqlResponseSchema.safeParse({ workItems: [] });

    expect(result.success).toBe(true);
  });

  it('rejects when workItems is missing', () => {
    const result = azdoWiqlResponseSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});

describe('azdoWorkItemSchema', () => {
  it('validates a full work item with relations', () => {
    const result = azdoWorkItemSchema.safeParse(workItem);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.fields['System.Title']).toBe('Implement auth flow');
    expect(result.data.fields['System.Tags']).toBe('backend; auth');
    expect(result.data.relations?.[0].rel).toBe(
      'System.LinkTypes.Hierarchy-Reverse',
    );
  });

  it('validates a minimal work item without optional fields', () => {
    const result = azdoWorkItemSchema.safeParse(workItemMinimal);

    expect(result.success).toBe(true);
  });

  it('accepts null relations', () => {
    const result = azdoWorkItemSchema.safeParse({
      ...workItemMinimal,
      relations: null,
    });

    expect(result.success).toBe(true);
  });

  it('accepts null AssignedTo', () => {
    const result = azdoWorkItemSchema.safeParse({
      id: 103,
      fields: { 'System.AssignedTo': null },
    });

    expect(result.success).toBe(true);
  });

  it('rejects when id is missing', () => {
    const result = azdoWorkItemSchema.safeParse({ fields: {} });

    expect(result.success).toBe(false);
  });
});

describe('azdoWorkItemsBatchResponseSchema', () => {
  it('validates a batch response', () => {
    const result = azdoWorkItemsBatchResponseSchema.safeParse(batchResponse);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.value).toHaveLength(2);
    expect(result.data.count).toBe(2);
  });

  it('accepts batch without count', () => {
    const result = azdoWorkItemsBatchResponseSchema.safeParse({
      value: [],
    });

    expect(result.success).toBe(true);
  });

  it('rejects when value array is missing', () => {
    const result = azdoWorkItemsBatchResponseSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});

describe('azdoProjectResponseSchema', () => {
  it('validates a project response', () => {
    const result = azdoProjectResponseSchema.safeParse(projectResponse);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.name).toBe('MyProject');
    expect(result.data.state).toBe('wellFormed');
  });

  it('accepts project without optional state', () => {
    const result = azdoProjectResponseSchema.safeParse({
      id: 'proj-uuid',
      name: 'Proj',
    });

    expect(result.success).toBe(true);
  });

  it('rejects when name is missing', () => {
    const result = azdoProjectResponseSchema.safeParse({ id: 'proj-uuid' });

    expect(result.success).toBe(false);
  });
});

describe('azdoWiqlLinkResponseSchema', () => {
  it('validates a WIQL link query response', () => {
    const result = azdoWiqlLinkResponseSchema.safeParse(wiqlLinkResponse);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.workItemRelations).toHaveLength(2);
    expect(result.data.workItemRelations?.[0].source?.id).toBe(50);
    expect(result.data.workItemRelations?.[0].target?.id).toBe(101);
  });

  it('accepts null source in a link', () => {
    const result = azdoWiqlLinkResponseSchema.safeParse({
      workItemRelations: [{ source: null, target: { id: 1 } }],
    });

    expect(result.success).toBe(true);
  });

  it('accepts empty response without relations', () => {
    const result = azdoWiqlLinkResponseSchema.safeParse({});

    expect(result.success).toBe(true);
  });
});
