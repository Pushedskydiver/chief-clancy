import { describe, expect, it } from 'vitest';

import {
  bitbucketCommentsSchema,
  bitbucketPrCreatedSchema,
  bitbucketPrListSchema,
  bitbucketServerActivitiesSchema,
  bitbucketServerPrCreatedSchema,
  bitbucketServerPrListSchema,
} from './bitbucket.js';

describe('Bitbucket Cloud schemas', () => {
  it('parses PR list response', () => {
    const data = {
      values: [
        {
          id: 10,
          links: { html: { href: 'https://bb.org/pr/10' } },
          participants: [{ state: 'approved', role: 'REVIEWER' }],
        },
      ],
    };
    expect(bitbucketPrListSchema.parse(data).values).toHaveLength(1);
  });

  it('parses PR created response', () => {
    const data = { id: 42, links: { html: { href: 'https://bb.org/pr/42' } } };
    const parsed = bitbucketPrCreatedSchema.parse(data);
    expect(parsed.id).toBe(42);
    expect(parsed.links?.html?.href).toBe('https://bb.org/pr/42');
  });

  it('parses comments response', () => {
    const data = {
      values: [
        {
          content: { raw: 'Fix this' },
          inline: { path: 'src/a.ts' },
          created_on: '2026-01-01T00:00:00Z',
        },
      ],
    };
    expect(bitbucketCommentsSchema.parse(data).values).toHaveLength(1);
  });
});

describe('Bitbucket Server schemas', () => {
  it('parses PR list response', () => {
    const data = {
      values: [
        {
          id: 10,
          links: { self: [{ href: 'https://bb.acme.com/pr/10' }] },
          reviewers: [{ status: 'APPROVED' }],
        },
      ],
    };
    expect(bitbucketServerPrListSchema.parse(data).values).toHaveLength(1);
  });

  it('parses PR created response', () => {
    const data = {
      id: 42,
      links: { self: [{ href: 'https://bb.acme.com/pr/42' }] },
    };
    const parsed = bitbucketServerPrCreatedSchema.parse(data);
    expect(parsed.id).toBe(42);
  });

  it('parses activities response', () => {
    const data = {
      values: [
        {
          action: 'COMMENTED',
          comment: { text: 'Fix', createdDate: 1000 },
        },
      ],
    };
    expect(bitbucketServerActivitiesSchema.parse(data).values).toHaveLength(1);
  });
});
