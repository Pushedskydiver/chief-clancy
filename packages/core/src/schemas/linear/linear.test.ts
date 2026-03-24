import { describe, expect, it } from 'vitest';

import {
  linearIssueLabelSearchResponseSchema,
  linearIssueRelationsResponseSchema,
  linearIssueSearchResponseSchema,
  linearIssuesResponseSchema,
  linearIssueUpdateResponseSchema,
  linearLabelCreateResponseSchema,
  linearTeamLabelsResponseSchema,
  linearViewerResponseSchema,
  linearWorkflowStatesResponseSchema,
  linearWorkspaceLabelsResponseSchema,
} from './linear.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const issuesResponse = {
  data: {
    viewer: {
      assignedIssues: {
        nodes: [
          {
            id: 'issue-uuid-1',
            identifier: 'TEAM-42',
            title: 'Implement dark mode',
            description: 'Add dark mode support to the settings page.',
            parent: {
              identifier: 'TEAM-10',
              title: 'UI Polish',
            },
            labels: {
              nodes: [{ name: 'frontend' }, { name: 'design' }],
            },
          },
          {
            id: 'issue-uuid-2',
            identifier: 'TEAM-43',
            title: 'Fix typo',
          },
        ],
      },
    },
  },
};

const viewerResponse = {
  data: {
    viewer: {
      id: 'user-uuid-1',
    },
  },
};

const workflowStatesResponse = {
  data: {
    workflowStates: {
      nodes: [{ id: 'state-1' }, { id: 'state-2' }, { id: 'state-3' }],
    },
  },
};

const issueUpdateResponse = {
  data: {
    issueUpdate: {
      success: true,
    },
  },
};

const relationsResponse = {
  data: {
    issue: {
      relations: {
        nodes: [
          {
            type: 'blocks',
            relatedIssue: {
              state: { type: 'completed' },
            },
          },
          {
            type: 'is_blocked_by',
            relatedIssue: {
              state: { type: 'unstarted' },
            },
          },
        ],
      },
    },
  },
};

const searchResponse = {
  data: {
    issueSearch: {
      nodes: [{ state: { type: 'started' } }, { state: { type: 'completed' } }],
    },
  },
};

const teamLabelsResponse = {
  data: {
    team: {
      labels: {
        nodes: [
          { id: 'label-1', name: 'bug' },
          { id: 'label-2', name: 'feature' },
        ],
      },
    },
  },
};

const workspaceLabelsResponse = {
  data: {
    issueLabels: {
      nodes: [
        { id: 'label-1', name: 'bug' },
        { id: 'label-2', name: 'feature' },
      ],
    },
  },
};

const labelCreateResponse = {
  data: {
    issueLabelCreate: {
      issueLabel: { id: 'new-label-id' },
      success: true,
    },
  },
};

const issueLabelSearchResponse = {
  data: {
    issueSearch: {
      nodes: [
        {
          id: 'issue-1',
          labels: {
            nodes: [
              { id: 'label-1', name: 'bug' },
              { id: 'label-2', name: 'feature' },
            ],
          },
        },
      ],
    },
  },
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('linearIssuesResponseSchema', () => {
  it('validates a full issues response', () => {
    const result = linearIssuesResponseSchema.safeParse(issuesResponse);

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Fixture is fully populated — non-null assertions are safe here
    const nodes = result.data.data!.viewer!.assignedIssues!.nodes;
    expect(nodes).toHaveLength(2);
    expect(nodes[0].identifier).toBe('TEAM-42');
    expect(nodes[0].labels?.nodes[0].name).toBe('frontend');
  });

  it('accepts minimal response with only required node fields', () => {
    const minimal = {
      data: {
        viewer: {
          assignedIssues: {
            nodes: [{ id: 'id-1', identifier: 'T-1', title: 'Minimal' }],
          },
        },
      },
    };
    const result = linearIssuesResponseSchema.safeParse(minimal);

    expect(result.success).toBe(true);
  });

  it('accepts null parent and description', () => {
    const result = linearIssuesResponseSchema.safeParse({
      data: {
        viewer: {
          assignedIssues: {
            nodes: [
              {
                id: 'id-1',
                identifier: 'T-1',
                title: 'Null parent',
                description: null,
                parent: null,
              },
            ],
          },
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it('accepts empty data wrapper', () => {
    const result = linearIssuesResponseSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it('rejects when node id is missing', () => {
    const result = linearIssuesResponseSchema.safeParse({
      data: {
        viewer: {
          assignedIssues: {
            nodes: [{ identifier: 'T-1', title: 'No ID' }],
          },
        },
      },
    });

    expect(result.success).toBe(false);
  });
});

describe('linearViewerResponseSchema', () => {
  it('validates a viewer response', () => {
    const result = linearViewerResponseSchema.safeParse(viewerResponse);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.data!.viewer!.id).toBe('user-uuid-1');
  });

  it('accepts empty data wrapper', () => {
    const result = linearViewerResponseSchema.safeParse({});

    expect(result.success).toBe(true);
  });
});

describe('linearWorkflowStatesResponseSchema', () => {
  it('validates a workflow states response', () => {
    const result = linearWorkflowStatesResponseSchema.safeParse(
      workflowStatesResponse,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.data!.workflowStates!.nodes).toHaveLength(3);
  });

  it('accepts empty nodes array', () => {
    const result = linearWorkflowStatesResponseSchema.safeParse({
      data: { workflowStates: { nodes: [] } },
    });

    expect(result.success).toBe(true);
  });
});

describe('linearIssueUpdateResponseSchema', () => {
  it('validates an issue update response', () => {
    const result =
      linearIssueUpdateResponseSchema.safeParse(issueUpdateResponse);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.data!.issueUpdate!.success).toBe(true);
  });

  it('accepts empty data wrapper', () => {
    const result = linearIssueUpdateResponseSchema.safeParse({});

    expect(result.success).toBe(true);
  });
});

describe('linearIssueRelationsResponseSchema', () => {
  it('validates a relations response with blockers', () => {
    const result =
      linearIssueRelationsResponseSchema.safeParse(relationsResponse);

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Fixture is fully populated — non-null assertions are safe here
    const nodes = result.data.data!.issue!.relations!.nodes;
    expect(nodes).toHaveLength(2);
    expect(nodes[0].type).toBe('blocks');
    expect(nodes[0].relatedIssue?.state?.type).toBe('completed');
  });

  it('accepts empty relations nodes', () => {
    const result = linearIssueRelationsResponseSchema.safeParse({
      data: { issue: { relations: { nodes: [] } } },
    });

    expect(result.success).toBe(true);
  });
});

describe('linearIssueSearchResponseSchema', () => {
  it('validates a search response with state info', () => {
    const result = linearIssueSearchResponseSchema.safeParse(searchResponse);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.data!.issueSearch!.nodes).toHaveLength(2);
    expect(result.data.data!.issueSearch!.nodes[0].state?.type).toBe('started');
  });
});

describe('linearTeamLabelsResponseSchema', () => {
  it('validates a team labels response', () => {
    const result = linearTeamLabelsResponseSchema.safeParse(teamLabelsResponse);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.data!.team!.labels!.nodes).toHaveLength(2);
    expect(result.data.data!.team!.labels!.nodes[0].name).toBe('bug');
  });
});

describe('linearWorkspaceLabelsResponseSchema', () => {
  it('validates a workspace labels response', () => {
    const result = linearWorkspaceLabelsResponseSchema.safeParse(
      workspaceLabelsResponse,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.data!.issueLabels!.nodes).toHaveLength(2);
  });
});

describe('linearLabelCreateResponseSchema', () => {
  it('validates a label create response', () => {
    const result =
      linearLabelCreateResponseSchema.safeParse(labelCreateResponse);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.data!.issueLabelCreate!.issueLabel?.id).toBe(
      'new-label-id',
    );
    expect(result.data.data!.issueLabelCreate!.success).toBe(true);
  });
});

describe('linearIssueLabelSearchResponseSchema', () => {
  it('validates a label search response', () => {
    const result = linearIssueLabelSearchResponseSchema.safeParse(
      issueLabelSearchResponse,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    const nodes = result.data.data!.issueSearch!.nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].labels?.nodes[0].id).toBe('label-1');
  });

  it('rejects when node id is missing', () => {
    const result = linearIssueLabelSearchResponseSchema.safeParse({
      data: {
        issueSearch: {
          nodes: [{ labels: { nodes: [] } }],
        },
      },
    });

    expect(result.success).toBe(false);
  });
});
