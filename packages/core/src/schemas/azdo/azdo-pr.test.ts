import { describe, expect, it } from 'vitest';

import {
  azdoPrCreatedSchema,
  azdoPrListSchema,
  azdoThreadListSchema,
} from './azdo-pr.js';

describe('AzDO PR schemas', () => {
  it('parses PR list response', () => {
    const data = {
      value: [{ pullRequestId: 42, status: 'active', reviewers: [] }],
      count: 1,
    };
    expect(azdoPrListSchema.parse(data).value).toHaveLength(1);
  });

  it('parses PR created response', () => {
    const data = { pullRequestId: 42 };
    expect(azdoPrCreatedSchema.parse(data).pullRequestId).toBe(42);
  });

  it('parses thread list response', () => {
    const data = {
      value: [
        {
          id: 1,
          status: 'active',
          comments: [{ content: 'Fix this', commentType: 'text' }],
          threadContext: { filePath: '/src/a.ts' },
          publishedDate: '2026-01-01T00:00:00Z',
        },
      ],
      count: 1,
    };
    const parsed = azdoThreadListSchema.parse(data);
    expect(parsed.value).toHaveLength(1);
    expect(parsed.value[0]?.threadContext?.filePath).toBe('/src/a.ts');
  });

  it('parses thread with null threadContext (general comment)', () => {
    const data = {
      value: [
        {
          id: 1,
          comments: [{ content: 'General note' }],
          threadContext: null,
        },
      ],
    };
    const parsed = azdoThreadListSchema.parse(data);
    expect(parsed.value[0]?.threadContext).toBeNull();
  });
});
