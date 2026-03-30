import { describe, expect, it } from 'vitest';

import {
  githubCommentsResponseSchema,
  githubIssueSchema,
  githubIssuesResponseSchema,
  githubPrCommentsSchema,
  githubPrListSchema,
  githubRepoPingSchema,
  githubReviewListSchema,
} from './github.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const issue = {
  number: 42,
  title: 'Add dark mode',
  body: 'We need a dark theme for accessibility.',
  labels: [{ name: 'feature' }, { name: 'ui' }],
};

const issueMinimal = {
  number: 1,
  title: 'Minimal issue',
};

const issuePr = {
  number: 10,
  title: 'PR issue',
  pull_request: { url: 'https://api.github.com/repos/acme/app/pulls/10' },
};

const comment = {
  id: 100,
  body: 'Looks good to me.',
  created_at: '2026-01-15T10:00:00Z',
  user: { login: 'reviewer' },
};

const pr = {
  number: 5,
  html_url: 'https://github.com/acme/app/pull/5',
  state: 'open',
};

const review = {
  state: 'APPROVED',
  user: { login: 'reviewer' },
  submitted_at: '2026-01-15T12:00:00Z',
};

const prComment = {
  body: 'Nit: rename this variable.',
  path: 'src/index.ts',
  created_at: '2026-01-15T11:00:00Z',
  user: { login: 'reviewer' },
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('githubRepoPingSchema', () => {
  it('validates a repo ping response', () => {
    const result = githubRepoPingSchema.safeParse({
      id: 123456,
      name: 'clancy-qa-sandbox',
      full_name: 'Pushedskydiver/clancy-qa-sandbox',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.id).toBe(123456);
    expect(result.data.full_name).toBe('Pushedskydiver/clancy-qa-sandbox');
  });

  it('rejects when required fields are missing', () => {
    const result = githubRepoPingSchema.safeParse({ id: 1 });

    expect(result.success).toBe(false);
  });
});

describe('githubIssueSchema', () => {
  it('validates a full issue', () => {
    const result = githubIssueSchema.safeParse(issue);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.number).toBe(42);
    expect(result.data.title).toBe('Add dark mode');
    expect(result.data.labels?.[0].name).toBe('feature');
  });

  it('accepts a minimal issue without optional fields', () => {
    const result = githubIssueSchema.safeParse(issueMinimal);

    expect(result.success).toBe(true);
  });

  it('accepts an issue with pull_request field', () => {
    const result = githubIssueSchema.safeParse(issuePr);

    expect(result.success).toBe(true);
  });

  it('accepts null body', () => {
    const result = githubIssueSchema.safeParse({
      ...issueMinimal,
      body: null,
    });

    expect(result.success).toBe(true);
  });

  it('rejects when number is missing', () => {
    const result = githubIssueSchema.safeParse({ title: 'No number' });

    expect(result.success).toBe(false);
  });
});

describe('githubIssuesResponseSchema', () => {
  it('validates an array of issues', () => {
    const result = githubIssuesResponseSchema.safeParse([issue, issueMinimal]);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toHaveLength(2);
  });

  it('accepts an empty array', () => {
    const result = githubIssuesResponseSchema.safeParse([]);

    expect(result.success).toBe(true);
  });
});

describe('githubCommentsResponseSchema', () => {
  it('validates an array of comments', () => {
    const result = githubCommentsResponseSchema.safeParse([comment]);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data[0].body).toBe('Looks good to me.');
    expect(result.data[0].user?.login).toBe('reviewer');
  });

  it('accepts a comment with null body', () => {
    const result = githubCommentsResponseSchema.safeParse([
      { ...comment, body: null },
    ]);

    expect(result.success).toBe(true);
  });

  it('rejects when required id is missing', () => {
    const result = githubCommentsResponseSchema.safeParse([
      { body: 'No id', created_at: '2026-01-15T10:00:00Z' },
    ]);

    expect(result.success).toBe(false);
  });
});

describe('githubPrListSchema', () => {
  it('validates an array of PRs', () => {
    const result = githubPrListSchema.safeParse([pr]);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data[0].state).toBe('open');
    expect(result.data[0].html_url).toBe('https://github.com/acme/app/pull/5');
  });

  it('rejects when required html_url is missing', () => {
    const result = githubPrListSchema.safeParse([{ number: 5, state: 'open' }]);

    expect(result.success).toBe(false);
  });
});

describe('githubReviewListSchema', () => {
  it('validates an array of reviews', () => {
    const result = githubReviewListSchema.safeParse([review]);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data[0].state).toBe('APPROVED');
  });

  it('rejects when user is missing', () => {
    const result = githubReviewListSchema.safeParse([
      { state: 'APPROVED', submitted_at: '2026-01-15T12:00:00Z' },
    ]);

    expect(result.success).toBe(false);
  });
});

describe('githubPrCommentsSchema', () => {
  it('validates an array of PR inline comments', () => {
    const result = githubPrCommentsSchema.safeParse([prComment]);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data[0].path).toBe('src/index.ts');
  });

  it('accepts a minimal PR comment with no optional fields', () => {
    const result = githubPrCommentsSchema.safeParse([{}]);

    expect(result.success).toBe(true);
  });
});
