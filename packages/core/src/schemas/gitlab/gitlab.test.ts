import { describe, expect, it } from 'vitest';

import {
  gitlabDiscussionsSchema,
  gitlabMrCreatedSchema,
  gitlabMrListSchema,
} from './gitlab.js';

describe('GitLab MR schemas', () => {
  it('parses MR list response', () => {
    const data = [{ iid: 5, web_url: 'https://gl.com/mr/5' }];
    expect(gitlabMrListSchema.parse(data)).toHaveLength(1);
  });

  it('parses MR created response', () => {
    const data = { iid: 42, web_url: 'https://gl.com/mr/42' };
    const parsed = gitlabMrCreatedSchema.parse(data);
    expect(parsed.iid).toBe(42);
    expect(parsed.web_url).toBe('https://gl.com/mr/42');
  });

  it('parses discussions response', () => {
    const data = [
      {
        id: 'd1',
        notes: [
          {
            body: 'Fix this',
            resolvable: true,
            system: false,
            type: 'DiffNote',
          },
        ],
      },
    ];
    const parsed = gitlabDiscussionsSchema.parse(data);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.notes).toHaveLength(1);
  });
});
