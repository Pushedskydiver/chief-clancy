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
 * guarantee. Same contract as `storage/elements.ts`'s `accepted.ts`.
 *
 * The caller owns `sessionDir`, but the `threads/` subdirectory is this
 * module's, so `appendThreadMessage` creates it (unlike
 * `storage/comments.ts`, whose file sits directly in the caller-owned
 * directory). `threadId` interpolates into the path, so both entry points
 * guard against a traversal-shaped id, as `storage/elements.ts` does for
 * `slot`.
 *
 * Read semantics follow the append-only JSONL sibling `comments.ts`: a
 * missing file means "no messages yet" (empty list, not an error), and an
 * unparseable line is skipped so a crash-truncated tail doesn't poison the
 * whole thread. That skip is deliberately lenient — it also swallows a
 * mid-file line that fails schema validation, trading strict corruption
 * detection for read availability on an append-only log. The mutable
 * `elements/<slot>.json` surface makes the opposite trade (throws on
 * schema-invalid), because there a bad parse means total loss of the
 * element's state rather than one lost message. Other I/O failures
 * (EACCES, EISDIR, ENOSPC) propagate.
 *
 * This supersedes the flat variant-keyed `storage/comments.ts` log; that
 * module stays until `generate/regenerate.ts` migrates off the `Comment`
 * type it still imports.
 */
import type { ThreadMessage } from '../schemas/thread-message.js';

import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

import { z } from 'zod/mini';

import { threadMessageSchema } from '../schemas/thread-message.js';

const THREADS_DIR = 'threads';

const isNodeFsError = (err: unknown): err is NodeJS.ErrnoException =>
  typeof err === 'object' && err !== null && 'code' in err;

/**
 * Resolve `<sessionDir>/threads/<threadId>.jsonl`, rejecting a `threadId`
 * shaped to escape the threads dir via path traversal.
 */
function threadPath(sessionDir: string, threadId: string): string {
  const dir = join(sessionDir, THREADS_DIR);
  const path = join(dir, `${threadId}.jsonl`);
  const rel = relative(resolve(dir), resolve(path));
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(
      `thread storage: thread id "${threadId}" resolves outside the threads dir`,
    );
  }
  return path;
}

export async function appendThreadMessage(
  sessionDir: string,
  threadId: string,
  message: ThreadMessage,
): Promise<void> {
  const path = threadPath(sessionDir, threadId);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, JSON.stringify(message) + '\n', 'utf8');
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

  return raw
    .split('\n')
    .filter((line) => line.length > 0)
    .flatMap((line): readonly ThreadMessage[] => {
      try {
        return [z.parse(threadMessageSchema, JSON.parse(line))];
      } catch {
        return [];
      }
    });
}
