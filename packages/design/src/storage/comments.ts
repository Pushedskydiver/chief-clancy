/**
 * JSONL append-only comment persistence — Phase F slice 18.
 *
 * One comments file per session at `<sessionDir>/comments.jsonl`. Each
 * line is a single self-contained `Comment` record. Append-only avoids
 * concurrent-write hazards; per-line records are trivially parseable
 * (`for line of file.split('\n') → JSON.parse(line)`) and survive a
 * crash mid-write — the partial last line is dropped on read.
 *
 * Missing file is treated as "no comments yet" (empty list), not an
 * error. Unparseable lines are skipped to absorb crash-truncated tails;
 * I/O failures (EACCES, ENOSPC) propagate as broken-invariant throws.
 */
import type { Comment } from '../schemas/comment.js';

import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { z } from 'zod/mini';

import { commentSchema } from '../schemas/comment.js';

const COMMENTS_FILENAME = 'comments.jsonl';

const isNodeFsError = (err: unknown): err is NodeJS.ErrnoException =>
  typeof err === 'object' && err !== null && 'code' in err;

export async function appendComment(
  sessionDir: string,
  record: Comment,
): Promise<void> {
  const path = join(sessionDir, COMMENTS_FILENAME);
  await appendFile(path, JSON.stringify(record) + '\n', 'utf8');
}

export async function readComments(
  sessionDir: string,
): Promise<readonly Comment[]> {
  const path = join(sessionDir, COMMENTS_FILENAME);
  const raw = await readFile(path, 'utf8').catch(
    (err: unknown): string | null => {
      if (isNodeFsError(err) && err.code === 'ENOENT') return null;
      throw err;
    },
  );
  if (raw === null) return [];

  return raw
    .split('\n')
    .filter((line) => line.length > 0)
    .flatMap((line): readonly Comment[] => {
      try {
        return [z.parse(commentSchema, JSON.parse(line))];
      } catch {
        return [];
      }
    });
}
