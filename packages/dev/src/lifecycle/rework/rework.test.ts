import type { PlatformReworkHandlers } from './rework-types.js';
import type { ProgressFs } from '~/d/lifecycle/progress.js';

import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';

import {
  buildReworkComment,
  fetchReworkFromPrReview,
  postReworkActions,
} from './rework.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeProgressFs(content: string): ProgressFs {
  return {
    readFile: vi.fn(() => content),
    appendFile: vi.fn(),
    mkdir: vi.fn(),
  };
}

function makeHandlers(
  overrides: Partial<PlatformReworkHandlers> = {},
): PlatformReworkHandlers {
  return {
    checkReviewState: vi.fn(() => Promise.resolve(undefined)),
    fetchComments: vi.fn(() =>
      Promise.resolve({ comments: [], discussionIds: undefined }),
    ),
    postComment: vi.fn(() => Promise.resolve(true)),
    resolveThreads: vi.fn(() => Promise.resolve(0)),
    reRequestReview: vi.fn(() => Promise.resolve(true)),
    ...overrides,
  };
}

// ─── buildReworkComment ─────────────────────────────────────────────────────

describe('buildReworkComment', () => {
  it('returns generic message for empty feedback', () => {
    const result = buildReworkComment([]);

    expect(result).toBe('[clancy] Rework pushed addressing reviewer feedback.');
  });

  it('returns count and summary for single feedback item', () => {
    const result = buildReworkComment(['Fix the validation logic']);

    expect(result).toContain('1 feedback item.');
    expect(result).toContain('- Fix the validation logic');
  });

  it('returns plural count for multiple feedback items', () => {
    const result = buildReworkComment(['Fix A', 'Fix B']);

    expect(result).toContain('2 feedback items.');
  });

  it('truncates feedback items to 80 characters', () => {
    const longFeedback = 'A'.repeat(100);
    const result = buildReworkComment([longFeedback]);

    expect(result).toContain(`- ${'A'.repeat(80)}`);
    expect(result).not.toContain('A'.repeat(81));
  });

  it('shows at most 3 feedback items with ellipsis', () => {
    const feedback = ['Fix A', 'Fix B', 'Fix C', 'Fix D'];
    const result = buildReworkComment(feedback);

    expect(result).toContain('4 feedback items.');
    expect(result).toContain('- Fix A');
    expect(result).toContain('- Fix B');
    expect(result).toContain('- Fix C');
    expect(result).not.toContain('- Fix D');
    expect(result).toContain('- ...');
  });

  it('does not add ellipsis for exactly 3 items', () => {
    const feedback = ['Fix A', 'Fix B', 'Fix C'];
    const result = buildReworkComment(feedback);

    expect(result).not.toContain('- ...');
  });

  it('starts with [clancy] prefix', () => {
    const result = buildReworkComment(['Fix something']);

    expect(result).toMatch(/^\[clancy\]/);
  });

  it('always starts with [clancy] for any feedback array', () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { maxLength: 10 }), (feedback) => {
        const result = buildReworkComment(feedback);
        expect(result).toMatch(/^\[clancy\]/);
      }),
    );
  });

  it('always returns a non-empty string', () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { maxLength: 10 }), (feedback) => {
        const result = buildReworkComment(feedback);
        expect(result.length).toBeGreaterThan(0);
      }),
    );
  });
});

// ─── fetchReworkFromPrReview ────────────────────────────────────────────────

describe('fetchReworkFromPrReview', () => {
  it('returns undefined when no progress entries exist', async () => {
    const fs = makeProgressFs('');
    const handlers = makeHandlers();

    const result = await fetchReworkFromPrReview({
      progressFs: fs,
      projectRoot: '/project',
      provider: 'github',
      handlers,
    });

    expect(result).toBeUndefined();
    expect(handlers.checkReviewState).not.toHaveBeenCalled();
  });

  it('returns rework result when changes are requested', async () => {
    const fs = makeProgressFs(
      '2026-03-20 10:00 | PROJ-42 | Fix login | PR_CREATED | pr:5',
    );
    const handlers = makeHandlers({
      checkReviewState: vi.fn(() =>
        Promise.resolve({
          hasChangesRequested: true,
          prNumber: 5,
          prUrl: 'https://github.com/acme/app/pull/5',
          reviewers: ['reviewer1'],
        }),
      ),
      fetchComments: vi.fn(() =>
        Promise.resolve({
          comments: ['Fix the error handling'],
          discussionIds: undefined,
        }),
      ),
    });

    const result = await fetchReworkFromPrReview({
      progressFs: fs,
      projectRoot: '/project',
      provider: 'github',
      handlers,
    });

    expect(result).toBeDefined();
    expect(result!.ticket.key).toBe('PROJ-42');
    expect(result!.feedback).toEqual(['Fix the error handling']);
    expect(result!.prNumber).toBe(5);
    expect(result!.reviewers).toEqual(['reviewer1']);
  });

  it('returns undefined when no changes are requested', async () => {
    const fs = makeProgressFs(
      '2026-03-20 10:00 | PROJ-42 | Fix login | PR_CREATED | pr:5',
    );
    const handlers = makeHandlers({
      checkReviewState: vi.fn(() =>
        Promise.resolve({
          hasChangesRequested: false,
          prNumber: 5,
          prUrl: 'https://github.com/acme/app/pull/5',
        }),
      ),
    });

    const result = await fetchReworkFromPrReview({
      progressFs: fs,
      projectRoot: '/project',
      provider: 'github',
      handlers,
    });

    expect(result).toBeUndefined();
  });

  it('skips candidates without changes and returns first with rework', async () => {
    const fs = makeProgressFs(
      [
        '2026-03-20 10:00 | PROJ-41 | First ticket | PR_CREATED | pr:4',
        '2026-03-20 11:00 | PROJ-42 | Second ticket | REWORK | pr:5',
      ].join('\n'),
    );
    const handlers = makeHandlers({
      checkReviewState: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({
          hasChangesRequested: true,
          prNumber: 5,
          prUrl: 'https://github.com/acme/app/pull/5',
        }),
      fetchComments: vi.fn(() =>
        Promise.resolve({ comments: ['Fix it'], discussionIds: undefined }),
      ),
    });

    const result = await fetchReworkFromPrReview({
      progressFs: fs,
      projectRoot: '/project',
      provider: 'github',
      handlers,
    });

    expect(result!.ticket.key).toBe('PROJ-42');
  });

  it('sets parentInfo from progress entry parent field', async () => {
    const fs = makeProgressFs(
      '2026-03-20 10:00 | PROJ-42 | Fix login | PR_CREATED | pr:5 | parent:PROJ-1',
    );
    const handlers = makeHandlers({
      checkReviewState: vi.fn(() =>
        Promise.resolve({
          hasChangesRequested: true,
          prNumber: 5,
          prUrl: 'https://github.com/acme/app/pull/5',
        }),
      ),
      fetchComments: vi.fn(() =>
        Promise.resolve({ comments: [], discussionIds: undefined }),
      ),
    });

    const result = await fetchReworkFromPrReview({
      progressFs: fs,
      projectRoot: '/project',
      provider: 'github',
      handlers,
    });

    expect(result!.ticket.parentInfo).toBe('PROJ-1');
  });

  it('defaults parentInfo to "none" when no parent', async () => {
    const fs = makeProgressFs(
      '2026-03-20 10:00 | PROJ-42 | Fix login | PR_CREATED | pr:5',
    );
    const handlers = makeHandlers({
      checkReviewState: vi.fn(() =>
        Promise.resolve({
          hasChangesRequested: true,
          prNumber: 5,
          prUrl: 'https://github.com/acme/app/pull/5',
        }),
      ),
      fetchComments: vi.fn(() =>
        Promise.resolve({ comments: [], discussionIds: undefined }),
      ),
    });

    const result = await fetchReworkFromPrReview({
      progressFs: fs,
      projectRoot: '/project',
      provider: 'github',
      handlers,
    });

    expect(result!.ticket.parentInfo).toBe('none');
  });

  it('includes PUSHED status candidates', async () => {
    const fs = makeProgressFs(
      '2026-03-20 10:00 | PROJ-42 | Fix login | PUSHED | pr:5',
    );
    const handlers = makeHandlers({
      checkReviewState: vi.fn(() =>
        Promise.resolve({
          hasChangesRequested: true,
          prNumber: 5,
          prUrl: 'https://github.com/acme/app/pull/5',
        }),
      ),
      fetchComments: vi.fn(() =>
        Promise.resolve({ comments: ['Needs fix'], discussionIds: undefined }),
      ),
    });

    const result = await fetchReworkFromPrReview({
      progressFs: fs,
      projectRoot: '/project',
      provider: 'github',
      handlers,
    });

    expect(result).toBeDefined();
    expect(result!.ticket.key).toBe('PROJ-42');
  });

  it('includes PUSH_FAILED status candidates', async () => {
    const fs = makeProgressFs(
      '2026-03-20 10:00 | PROJ-42 | Fix login | PUSH_FAILED | pr:5',
    );
    const handlers = makeHandlers({
      checkReviewState: vi.fn(() =>
        Promise.resolve({
          hasChangesRequested: true,
          prNumber: 5,
          prUrl: 'https://github.com/acme/app/pull/5',
        }),
      ),
      fetchComments: vi.fn(() =>
        Promise.resolve({ comments: [], discussionIds: undefined }),
      ),
    });

    const result = await fetchReworkFromPrReview({
      progressFs: fs,
      projectRoot: '/project',
      provider: 'github',
      handlers,
    });

    expect(result).toBeDefined();
    expect(result!.ticket.key).toBe('PROJ-42');
  });

  it('checks at most MAX_CANDIDATES (5) entries', async () => {
    const lines = Array.from(
      { length: 7 },
      (_, i) =>
        `2026-03-20 10:0${i} | PROJ-${i} | Ticket ${i} | PR_CREATED | pr:${i}`,
    ).join('\n');
    const fs = makeProgressFs(lines);
    const handlers = makeHandlers();

    await fetchReworkFromPrReview({
      progressFs: fs,
      projectRoot: '/project',
      provider: 'github',
      handlers,
    });

    expect(handlers.checkReviewState).toHaveBeenCalledTimes(5);
  });

  it('propagates error when checkReviewState throws', async () => {
    const fs = makeProgressFs(
      '2026-03-20 10:00 | PROJ-42 | Fix login | PR_CREATED | pr:5',
    );
    const handlers = makeHandlers({
      checkReviewState: vi.fn(() => Promise.reject(new Error('network error'))),
    });

    await expect(
      fetchReworkFromPrReview({
        progressFs: fs,
        projectRoot: '/project',
        provider: 'github',
        handlers,
      }),
    ).rejects.toThrow('network error');
  });
});

// ─── postReworkActions ──────────────────────────────────────────────────────

describe('postReworkActions', () => {
  it('posts a rework comment', async () => {
    const handlers = makeHandlers();

    await postReworkActions({
      handlers,
      prNumber: 5,
      feedback: ['Fix validation'],
    });

    expect(handlers.postComment).toHaveBeenCalledWith(
      5,
      expect.stringContaining('[clancy]'),
    );
  });

  it('resolves discussion threads when provided', async () => {
    const handlers = makeHandlers();

    await postReworkActions({
      handlers,
      prNumber: 5,
      feedback: [],
      discussionIds: ['disc-1', 'disc-2'],
    });

    expect(handlers.resolveThreads).toHaveBeenCalledWith(5, [
      'disc-1',
      'disc-2',
    ]);
  });

  it('re-requests review when reviewers provided', async () => {
    const handlers = makeHandlers();

    await postReworkActions({
      handlers,
      prNumber: 5,
      feedback: [],
      reviewers: ['reviewer1'],
    });

    expect(handlers.reRequestReview).toHaveBeenCalledWith(5, ['reviewer1']);
  });

  it('skips thread resolution when no discussion IDs', async () => {
    const handlers = makeHandlers();

    await postReworkActions({
      handlers,
      prNumber: 5,
      feedback: [],
    });

    expect(handlers.resolveThreads).not.toHaveBeenCalled();
  });

  it('skips review re-request when no reviewers', async () => {
    const handlers = makeHandlers();

    await postReworkActions({
      handlers,
      prNumber: 5,
      feedback: [],
    });

    expect(handlers.reRequestReview).not.toHaveBeenCalled();
  });

  it('does not throw when postComment fails', async () => {
    const handlers = makeHandlers({
      postComment: vi.fn(() => Promise.reject(new Error('Network error'))),
    });

    await expect(
      postReworkActions({
        handlers,
        prNumber: 5,
        feedback: ['Fix it'],
      }),
    ).resolves.toBeUndefined();
  });

  it('does not throw when resolveThreads fails', async () => {
    const handlers = makeHandlers({
      resolveThreads: vi.fn(() => Promise.reject(new Error('Network error'))),
    });

    await expect(
      postReworkActions({
        handlers,
        prNumber: 5,
        feedback: [],
        discussionIds: ['disc-1'],
      }),
    ).resolves.toBeUndefined();
  });
});
