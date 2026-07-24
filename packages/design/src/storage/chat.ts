/**
 * JSONL chat persistence — Phase F (UI-vision rework, slice A3).
 *
 * One append-only file per session at `<sessionDir>/chat.jsonl` (spec
 * §2.8): the global conversation and the single source of truth for
 * message *content*. Page-level messages live only here; element-scoped
 * messages are also written to `threads/{threadId}.jsonl`, carrying a body
 * tagged with the `[threadId] slot ` prefix that the thread side omits
 * (§2.8 body-normalisation rule — see `storage/body-normalisation.ts`).
 *
 * `ts` arrives on the record rather than being minted here — a single user
 * action writes one chat line and one thread line, and the pair must share
 * a timestamp, which only a caller-side clock can guarantee. Same contract
 * as `storage/threads.ts` and `storage/elements.ts` (modules handed a
 * finished record stay clock-free; `storage/approve.ts`, which *constructs*
 * its record, mints its own).
 *
 * Unlike `storage/threads.ts`, this module does **not** mkdir: `chat.jsonl`
 * sits directly in `sessionDir` (no subdirectory to create), so — like the
 * superseded `storage/comments.ts` and like `storage/approve.ts` — the
 * caller owns the session-directory lifecycle. Appending into a session
 * that does not exist is a broken invariant, so ENOENT on the directory
 * propagates rather than being papered over by a recursive mkdir.
 *
 * Reads are strict, with one narrow exception: a crash can truncate the
 * final line mid-write, so a *last* line that fails `JSON.parse` is dropped
 * when the file doesn't end in a newline. Nothing else is forgiven. A line
 * that parses as JSON but fails the schema is version skew or corruption
 * rather than a torn write, so it throws even in the tail position —
 * otherwise the newest message would be silently droppable, which is a
 * user's prompt vanishing from the regeneration context with no error
 * anywhere. This is deliberately unlike `storage/comments.ts`'s fully
 * lenient read (which swallows every unparseable *and* schema-invalid
 * line). Non-final lines were framed by a newline and so must parse
 * outright. (Blank lines are skipped before any of this, since a complete
 * file ends in a newline.) A missing file means "no messages yet" (empty
 * list, not an error); other I/O failures (EACCES, EISDIR, ENOSPC)
 * propagate.
 *
 * Because reads are strict, `appendChatMessage` validates before writing:
 * one bad line would otherwise make the whole chat unreadable, and the type
 * alone doesn't cover a caller assembling a record from untyped input.
 */
import type { ChatMessage } from '../schemas/chat-message.js';

import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { z } from 'zod/mini';

import { chatMessageSchema } from '../schemas/chat-message.js';
import { isNodeFsError } from './fs-errors.js';

const CHAT_FILENAME = 'chat.jsonl';

export async function appendChatMessage(
  sessionDir: string,
  message: ChatMessage,
): Promise<void> {
  const validated = z.parse(chatMessageSchema, message);
  await appendFile(
    join(sessionDir, CHAT_FILENAME),
    JSON.stringify(validated) + '\n',
    'utf8',
  );
}

export async function readChatMessages(
  sessionDir: string,
): Promise<readonly ChatMessage[]> {
  const raw = await readFile(join(sessionDir, CHAT_FILENAME), 'utf8').catch(
    (err: unknown): string | null => {
      if (isNodeFsError(err) && err.code === 'ENOENT') return null;
      throw err;
    },
  );
  if (raw === null) return [];

  const rows = raw.split('\n').filter((line) => line.length > 0);
  const tailMayBeTorn = !raw.endsWith('\n');

  return rows.flatMap((line, index): readonly ChatMessage[] => {
    const isTornTail = tailMayBeTorn && index === rows.length - 1;
    try {
      return [z.parse(chatMessageSchema, JSON.parse(line))];
    } catch (err) {
      // A torn write leaves *unparseable bytes*, and only on the last line.
      // Valid JSON that fails the schema is version skew or corruption — it
      // must surface even in the tail position, or the newest message
      // becomes silently droppable.
      if (isTornTail && err instanceof SyntaxError) return [];
      throw err;
    }
  });
}
