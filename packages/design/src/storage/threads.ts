/**
 * JSONL thread persistence — Phase F (UI-vision rework, slice A2).
 *
 * One append-only file per element thread at
 * `<sessionDir>/threads/<threadId>.jsonl` (spec §2.8). Each line is a
 * self-contained `ThreadMessage`, so re-opening a thread costs one file
 * read instead of a scan-and-filter over the whole session's chat log.
 *
 * The file is durable, not a derived view: `chat.jsonl` carries the same
 * message text — behind a `[threadId] slot ` tag that the chat side
 * prepends and thread lines omit (§2.8 body-normalisation rule) — but not
 * the `tag` / `textSnippet` / `status` anchor fields, so a thread rebuilt
 * from chat alone loses its stale-anchor lifecycle state (spec §2.8
 * reconstruction note).
 *
 * `ts` arrives on the record rather than being minted here — a single
 * user action writes one thread line and one `chat.jsonl` line, and the
 * pair must share a timestamp, which only a caller-side clock can
 * guarantee. Same contract `storage/elements.ts` uses for the `accepted`
 * pointer's own `ts`. (`storage/approve.ts` mints its timestamp because
 * it *constructs* its record; modules handed a finished record cannot.)
 *
 * `appendThreadMessage` creates the `threads/` subdirectory, which
 * `storage/comments.ts` has no equivalent of — its file sits directly in
 * `sessionDir`. The `recursive` mkdir will also materialise a missing
 * `sessionDir`, so this module does not enforce the caller-owns-the-
 * session-directory expectation that `storage/approve.ts` does by
 * omission.
 *
 * Both entry points constrain `threadId` to an id-shaped charset rather
 * than merely containing it, because it interpolates into a filename.
 * Containment alone would silently normalise separators, so `x/../y`
 * would alias onto thread `y` and `''` would open a real file named
 * `.jsonl`. (`storage/elements.ts` guards `slot` by containment instead —
 * correctly, since a stable-selector key like `h1.header` can't be held
 * to a charset.)
 *
 * Reads are strict, with one narrow exception: a crash can truncate the
 * final line mid-write, so a *last* line that fails `JSON.parse` is
 * dropped when the file doesn't end in a newline. Nothing else is
 * forgiven. A line that parses as JSON but fails the schema is version
 * skew or corruption rather than a torn write, so it throws even in the
 * tail position — otherwise the newest message in every thread would be
 * silently droppable, which is a user's comment vanishing from the
 * regeneration context with no error anywhere. Non-final lines were
 * framed by a newline and so must parse outright. (Blank lines are
 * skipped before any of this, since a complete file ends in a newline.)
 * A missing file means "no messages yet" (empty list, not an error);
 * other I/O failures (EACCES, EISDIR, ENOSPC) propagate.
 *
 * Because reads are strict, `appendThreadMessage` validates before
 * writing: one bad line would otherwise make the whole thread unreadable,
 * and the type alone doesn't cover a caller assembling a record from
 * untyped input.
 *
 * This supersedes the flat variant-keyed `storage/comments.ts` log. The
 * two comment modules come out together once `generate/regenerate.ts`
 * migrates off `schemas/comment.ts` — that import is what pins the pair's
 * deletion. `storage/comments.ts` on its own has no importer but its own
 * test.
 */
import type { ThreadMessage } from '../schemas/thread-message.js';

import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { z } from 'zod/mini';

import { threadMessageSchema } from '../schemas/thread-message.js';
import { isNodeFsError } from './fs-errors.js';

const THREADS_DIR = 'threads';

/**
 * A single portable path segment: non-empty, no separators, no dot segments.
 * Narrower than "filename-safe" — it still admits the Win32 device names
 * (`CON`, `NUL`, `COM1`…), which is tolerable only because `threadId` is
 * minted rather than user-supplied.
 */
const THREAD_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * Resolve `<sessionDir>/threads/<threadId>.jsonl`, rejecting any `threadId`
 * that isn't a single id-shaped path segment.
 */
function threadPath(sessionDir: string, threadId: string): string {
  if (!THREAD_ID_PATTERN.test(threadId)) {
    throw new Error(
      `thread storage: thread id "${threadId}" is not a valid thread id`,
    );
  }
  return join(sessionDir, THREADS_DIR, `${threadId}.jsonl`);
}

export async function appendThreadMessage(
  sessionDir: string,
  threadId: string,
  message: ThreadMessage,
): Promise<void> {
  const path = threadPath(sessionDir, threadId);
  const validated = z.parse(threadMessageSchema, message);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, JSON.stringify(validated) + '\n', 'utf8');
}

export async function readThreadMessages(
  sessionDir: string,
  threadId: string,
): Promise<readonly ThreadMessage[]> {
  const raw = await readFile(threadPath(sessionDir, threadId), 'utf8').catch(
    (err: unknown): string | null => {
      if (isNodeFsError(err) && err.code === 'ENOENT') return null;
      throw err;
    },
  );
  if (raw === null) return [];

  const rows = raw.split('\n').filter((line) => line.length > 0);
  const tailMayBeTorn = !raw.endsWith('\n');

  return rows.flatMap((line, index): readonly ThreadMessage[] => {
    const isTornTail = tailMayBeTorn && index === rows.length - 1;
    try {
      return [z.parse(threadMessageSchema, JSON.parse(line))];
    } catch (err) {
      // A torn write leaves *unparseable bytes*, and only on the last line.
      // Valid JSON that fails the schema is version skew or corruption — it
      // must surface even in the tail position, or the newest message in
      // every thread becomes silently droppable.
      if (isTornTail && err instanceof SyntaxError) return [];
      throw err;
    }
  });
}
