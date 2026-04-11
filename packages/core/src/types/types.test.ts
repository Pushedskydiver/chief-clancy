import type {
  Board,
  BoardProvider,
  FetchedTicket,
  FetchTicketOpts,
  GitPlatform,
  PrCreationResult,
  ProgressStatus,
  PrReviewState,
  RemoteInfo,
  Ticket,
} from './index.js';

import { describe, expect, it } from 'vitest';

import {
  COMPLETED_STATUSES,
  DELIVERED_STATUSES,
  FAILED_STATUSES,
} from './index.js';

describe('BoardProvider', () => {
  it('accepts all six providers', () => {
    const providers: BoardProvider[] = [
      'jira',
      'github',
      'linear',
      'shortcut',
      'notion',
      'azdo',
    ];
    expect(providers).toHaveLength(6);
  });
});

describe('Ticket', () => {
  it('satisfies the shape', () => {
    const ticket = {
      key: 'PROJ-1',
      title: 'Add feature',
      description: 'Details',
      provider: 'jira',
    } satisfies Ticket;
    expect(ticket.key).toBe('PROJ-1');
  });
});

describe('FetchedTicket', () => {
  it('requires mandatory fields', () => {
    const ticket = {
      key: 'PROJ-1',
      title: 'Add feature',
      description: 'Details',
      parentInfo: '',
      blockers: '',
    } satisfies FetchedTicket;
    expect(ticket.key).toBe('PROJ-1');
  });

  it('accepts all optional fields', () => {
    const ticket = {
      key: 'LIN-42',
      title: 'Linear ticket',
      description: 'Details',
      parentInfo: 'EPIC-1',
      blockers: 'PROJ-2',
      linearIssueId: 'uuid-123',
      issueId: 'uuid-456',
      labels: ['clancy:build'],
      status: 'unstarted',
    } satisfies FetchedTicket;
    expect(ticket.labels).toEqual(['clancy:build']);
  });
});

describe('FetchTicketOpts', () => {
  it('accepts empty options', () => {
    const opts: FetchTicketOpts = {};
    expect(opts.excludeHitl).toBeUndefined();
  });

  it('accepts all options', () => {
    const opts = {
      excludeHitl: true,
      buildLabel: 'clancy:build',
      limit: 10,
    } satisfies FetchTicketOpts;
    expect(opts.excludeHitl).toBe(true);
    expect(opts.limit).toBe(10);
  });
});

describe('Board', () => {
  it('defines all required methods', () => {
    const methodNames: ReadonlyArray<keyof Board> = [
      'ping',
      'validateInputs',
      'fetchTicket',
      'fetchTickets',
      'fetchBlockerStatus',
      'fetchChildrenStatus',
      'transitionTicket',
      'ensureLabel',
      'addLabel',
      'removeLabel',
      'sharedEnv',
    ];
    expect(methodNames).toHaveLength(11);
  });
});

describe('GitPlatform', () => {
  it('accepts all seven platforms', () => {
    const platforms: GitPlatform[] = [
      'github',
      'gitlab',
      'bitbucket',
      'bitbucket-server',
      'azure',
      'unknown',
      'none',
    ];
    expect(platforms).toHaveLength(7);
  });
});

describe('RemoteInfo', () => {
  it('satisfies the GitHub variant', () => {
    const info = {
      host: 'github',
      owner: 'org',
      repo: 'repo',
      hostname: 'github.com',
    } satisfies RemoteInfo;
    expect(info.host).toBe('github');
  });

  it('satisfies the GitLab variant', () => {
    const info = {
      host: 'gitlab',
      projectPath: 'group/project',
      hostname: 'gitlab.com',
    } satisfies RemoteInfo;
    expect(info.host).toBe('gitlab');
  });

  it('satisfies the Bitbucket variant', () => {
    const info = {
      host: 'bitbucket',
      workspace: 'ws',
      repoSlug: 'repo',
      hostname: 'bitbucket.org',
    } satisfies RemoteInfo;
    expect(info.host).toBe('bitbucket');
  });

  it('satisfies the Bitbucket Server variant', () => {
    const info = {
      host: 'bitbucket-server',
      projectKey: 'PROJ',
      repoSlug: 'repo',
      hostname: 'git.internal.com',
    } satisfies RemoteInfo;
    expect(info.host).toBe('bitbucket-server');
  });

  it('satisfies the Azure DevOps variant', () => {
    const info = {
      host: 'azure',
      org: 'myorg',
      project: 'myproject',
      repo: 'app',
      hostname: 'dev.azure.com',
    } satisfies RemoteInfo;
    expect(info.host).toBe('azure');
  });

  it('satisfies the none variant', () => {
    const info = { host: 'none' } satisfies RemoteInfo;
    expect(info.host).toBe('none');
  });
});

describe('PrCreationResult', () => {
  it('satisfies the success variant', () => {
    const result = {
      ok: true,
      url: 'https://github.com/org/repo/pull/1',
      number: 1,
    } satisfies PrCreationResult;
    expect(result.ok).toBe(true);
  });

  it('satisfies the failure variant', () => {
    const result = {
      ok: false,
      error: 'already exists',
      alreadyExists: true,
    } satisfies PrCreationResult;
    expect(result.ok).toBe(false);
  });
});

describe('PrReviewState', () => {
  it('satisfies the shape', () => {
    const state = {
      changesRequested: true,
      prNumber: 42,
      prUrl: 'https://github.com/org/repo/pull/42',
      reviewers: ['alice'],
    } satisfies PrReviewState;
    expect(state.changesRequested).toBe(true);
  });
});

describe('ProgressStatus constants', () => {
  it('DELIVERED_STATUSES contains delivery statuses', () => {
    const expected: ProgressStatus[] = [
      'PR_CREATED',
      'PUSHED',
      'REWORK',
      'RESUMED',
    ];
    expect(expected.every((s) => DELIVERED_STATUSES.has(s))).toBe(true);
    expect(DELIVERED_STATUSES.size).toBe(4);
  });

  it('COMPLETED_STATUSES contains completion statuses', () => {
    const expected: ProgressStatus[] = [
      'DONE',
      'PR_CREATED',
      'PUSHED',
      'EPIC_PR_CREATED',
      'RESUMED',
    ];
    expect(expected.every((s) => COMPLETED_STATUSES.has(s))).toBe(true);
    expect(COMPLETED_STATUSES.size).toBe(5);
  });

  it('FAILED_STATUSES contains failure statuses', () => {
    const expected: ProgressStatus[] = ['SKIPPED', 'PUSH_FAILED', 'TIME_LIMIT'];
    expect(expected.every((s) => FAILED_STATUSES.has(s))).toBe(true);
    expect(FAILED_STATUSES.size).toBe(3);
  });

  it('status sets are mutually exclusive for non-overlapping statuses', () => {
    expect(
      [...FAILED_STATUSES].every(
        (s) => !DELIVERED_STATUSES.has(s) && !COMPLETED_STATUSES.has(s),
      ),
    ).toBe(true);
  });
});
