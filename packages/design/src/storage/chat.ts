/**
 * JSONL chat persistence — Phase F (UI-vision rework, slice A3).
 *
 * One append-only file per session at `<sessionDir>/chat.jsonl` (spec §2.8):
 * the global conversation and the single source of truth for message
 * *content*. Page-level messages live only here; element-scoped messages are
 * also written to `threads/{threadId}.jsonl`, carrying a body tagged with the
 * `[threadId] slot ` prefix that the thread side omits (§2.8
 * body-normalisation rule — see `./body-normalisation.ts`). See `./README.md`
 * for how this module's choices sit against its siblings'.
 *
 * The chat line and its paired thread line are written for one user action and
 * must carry the same `ts`, which is the reason `ts` arrives on the record here
 * rather than being minted.
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
