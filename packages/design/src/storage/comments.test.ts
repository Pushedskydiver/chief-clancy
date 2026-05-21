import type { Comment } from '../schemas/comment.js';

import { appendFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { appendComment, readComments } from './comments.js';

const makeComment = (id: string, variantId: string, text: string): Comment => ({
  id,
  variantId,
  anchor: {
    selector: 'main > button',
    tag: 'button',
    textSnippet: 'Submit',
    boundingBox: { top: 100, left: 50, width: 120, height: 40 },
  },
  text,
  status: 'open',
  createdAt: '2026-05-21T17:30:00.000Z',
});

describe('JSONL comment persistence', () => {
  let sessionDir: string;

  beforeEach(async () => {
    sessionDir = await mkdtemp(join(tmpdir(), 'clancy-design-comments-'));
  });

  afterEach(async () => {
    await rm(sessionDir, { recursive: true, force: true });
  });

  it('writes 3 comments and reads them back in order', async () => {
    const comments: readonly Comment[] = [
      makeComment('c-1', 'variant-a', 'this button is too small'),
      makeComment('c-2', 'variant-b', 'wrong contrast on heading'),
      makeComment('c-3', 'variant-a', 'spacing feels cramped'),
    ];

    await comments.reduce<Promise<void>>(
      (prev, record) => prev.then(() => appendComment(sessionDir, record)),
      Promise.resolve(),
    );

    expect(await readComments(sessionDir)).toEqual(comments);
  });

  it('returns an empty list when no comments file exists yet', async () => {
    expect(await readComments(sessionDir)).toEqual([]);
  });

  it('skips a truncated last line left by a crash mid-append', async () => {
    const first = makeComment('c-1', 'variant-a', 'persisted cleanly');
    await appendComment(sessionDir, first);

    // Simulate a process crash mid-write: a partial JSON line with no trailing newline.
    await appendFile(
      join(sessionDir, 'comments.jsonl'),
      '{"id":"c-2","variantId":"variant-b","anchor"',
      'utf8',
    );

    expect(await readComments(sessionDir)).toEqual([first]);
  });
});
