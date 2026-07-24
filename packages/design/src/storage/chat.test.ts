import type { ChatMessage } from '../schemas/chat-message.js';

import { appendFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { appendChatMessage, readChatMessages } from './chat.js';

const makeMessage = (
  kind: ChatMessage['kind'],
  body: string,
  ts: string,
): ChatMessage => ({ ts, kind, body });

describe('JSONL chat persistence', () => {
  let sessionDir: string;

  beforeEach(async () => {
    sessionDir = await mkdtemp(join(tmpdir(), 'clancy-design-chat-'));
  });

  afterEach(async () => {
    await rm(sessionDir, { recursive: true, force: true });
  });

  it('appends page-level and element-scoped lines to chat.jsonl and reads them back in order', async () => {
    const first = makeMessage(
      'user',
      'make a pricing page hero',
      '2026-07-24T12:00:00.000Z',
    );
    const second = makeMessage(
      'assistant',
      'generated 3 page-level variants',
      '2026-07-24T12:00:05.000Z',
    );
    // Element-scoped: carries the tagged body plus the thread/slot refs, which
    // must survive the round-trip alongside the plain lines.
    const third: ChatMessage = {
      ts: '2026-07-24T12:01:00.000Z',
      kind: 'user',
      body: '[a7dH24] h1.header create 3 colour variants',
      threadRef: 'a7dH24',
      slotRef: 'h1.header',
    };

    await appendChatMessage(sessionDir, first);
    await appendChatMessage(sessionDir, second);
    await appendChatMessage(sessionDir, third);

    expect(await readChatMessages(sessionDir)).toEqual([first, second, third]);
  });

  it('returns an empty list when the session has no chat file yet', async () => {
    expect(await readChatMessages(sessionDir)).toEqual([]);
  });

  it('skips a truncated last line left by a crash mid-append', async () => {
    const first = makeMessage(
      'user',
      'persisted cleanly',
      '2026-07-24T12:00:00.000Z',
    );
    await appendChatMessage(sessionDir, first);

    // Simulate a process crash mid-write: a partial JSON line, no trailing newline.
    await appendFile(
      join(sessionDir, 'chat.jsonl'),
      '{"ts":"2026-07-24T12:00:05.000Z","kind":"assistant","body"',
      'utf8',
    );

    expect(await readChatMessages(sessionDir)).toEqual([first]);
  });

  it('throws on unparseable JSON that is not the torn tail', async () => {
    // Framed by a newline, so it was written whole — the crash story doesn't
    // explain it, and it must not be silently dropped.
    const first = makeMessage('user', 'first', '2026-07-24T12:00:00.000Z');
    await appendChatMessage(sessionDir, first);
    await appendFile(join(sessionDir, 'chat.jsonl'), '{ not json\n', 'utf8');
    await appendChatMessage(
      sessionDir,
      makeMessage('user', 'third', '2026-07-24T12:00:02.000Z'),
    );

    await expect(readChatMessages(sessionDir)).rejects.toThrow(SyntaxError);
  });

  it('throws on a schema-invalid line instead of dropping that message', async () => {
    // The failure mode this guards: a dropped line is a user message that
    // silently never reaches the regeneration prompt — the exact bug in the
    // superseded comments.ts lenient read.
    const first = makeMessage('user', 'first', '2026-07-24T12:00:00.000Z');
    await appendChatMessage(sessionDir, first);
    await appendFile(
      join(sessionDir, 'chat.jsonl'),
      JSON.stringify({ ...first, kind: 'system' }) + '\n',
      'utf8',
    );
    await appendChatMessage(
      sessionDir,
      makeMessage('user', 'third', '2026-07-24T12:00:02.000Z'),
    );

    await expect(readChatMessages(sessionDir)).rejects.toMatchObject({
      name: '$ZodError',
    });
  });

  it('throws on a schema-invalid final line when the file ends in a newline', async () => {
    // Newline-terminated, so the write completed — the torn-tail exemption is
    // positional AND conditional, and must not cover this.
    await appendFile(
      join(sessionDir, 'chat.jsonl'),
      JSON.stringify({
        ...makeMessage('user', 'bad kind', '2026-07-24T12:00:00.000Z'),
        kind: 'system',
      }) + '\n',
      'utf8',
    );

    await expect(readChatMessages(sessionDir)).rejects.toMatchObject({
      name: '$ZodError',
    });
  });

  it('throws on a schema-invalid final line even with no trailing newline', async () => {
    // A torn write leaves *unparseable* bytes. Valid JSON that fails the
    // schema is version skew, so the missing newline doesn't excuse it —
    // otherwise the last message in the chat is silently droppable.
    const first = makeMessage('user', 'first', '2026-07-24T12:00:00.000Z');
    await appendChatMessage(sessionDir, first);
    await appendFile(
      join(sessionDir, 'chat.jsonl'),
      JSON.stringify({ ...first, kind: 'system' }),
      'utf8',
    );

    await expect(readChatMessages(sessionDir)).rejects.toMatchObject({
      name: '$ZodError',
    });
  });

  it('rejects a message that does not satisfy the schema before writing it', async () => {
    // The cast is the point: this asserts the runtime guard for a caller that
    // assembled the record from untyped input, which the type can't cover.
    const invalid = {
      ...makeMessage('user', 'bad kind', '2026-07-24T12:00:00.000Z'),
      kind: 'system',
    } as unknown as ChatMessage;

    await expect(appendChatMessage(sessionDir, invalid)).rejects.toMatchObject({
      name: '$ZodError',
    });

    // Nothing was written, so the chat is still empty rather than unreadable.
    expect(await readChatMessages(sessionDir)).toEqual([]);
  });

  it('propagates ENOENT instead of creating a missing session directory', async () => {
    // chat.jsonl sits flat in sessionDir (like comments.jsonl), so the caller
    // owns the directory: appendChatMessage does not mkdir it into existence,
    // unlike storage/threads.ts which materialises its threads/ subdir.
    const missing = join(sessionDir, 'does-not-exist');

    await expect(
      appendChatMessage(
        missing,
        makeMessage('user', 'hi', '2026-07-24T12:00:00.000Z'),
      ),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rethrows a non-ENOENT read error instead of reporting an empty chat', async () => {
    // Make the target path a directory so readFile rejects with EISDIR — a
    // non-ENOENT error that must propagate, not be swallowed as "no messages".
    await mkdir(join(sessionDir, 'chat.jsonl'), { recursive: true });

    await expect(readChatMessages(sessionDir)).rejects.toMatchObject({
      code: 'EISDIR',
    });
  });

  it('round-trips arbitrary message text and optional refs through the JSONL framing', async () => {
    // The framing risk is a body containing the record delimiter. `fc.string()`
    // is printable-ASCII by default and emits no newline at all, so the
    // alphabet is spelled out to guarantee the delimiter, the JSON escapes, and
    // a multi-byte char actually show up. threadRef/slotRef alternate present/
    // absent so the optional fields are exercised on both paths.
    const messyText = fc
      .array(
        fc.constantFrom('a', '\n', '\r\n', '"', '\\', '\t', '😀', '{}', ''),
        { maxLength: 12 },
      )
      .map((parts) => parts.join(''));

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            kind: fc.constantFrom<ChatMessage['kind']>('user', 'assistant'),
            body: messyText,
            scoped: fc.boolean(),
          }),
          { minLength: 1, maxLength: 8 },
        ),
        async (drafts) => {
          const dir = await mkdtemp(join(tmpdir(), 'clancy-design-chat-fc-'));
          try {
            const messages = drafts.map((draft, index): ChatMessage => {
              const base = makeMessage(
                draft.kind,
                draft.body,
                `2026-07-24T12:00:0${index}.000Z`,
              );
              return draft.scoped
                ? { ...base, threadRef: 'a7dH24', slotRef: 'h1.header' }
                : base;
            });

            await messages.reduce(async (previous, message) => {
              await previous;
              await appendChatMessage(dir, message);
            }, Promise.resolve());

            expect(await readChatMessages(dir)).toEqual(messages);
          } finally {
            await rm(dir, { recursive: true, force: true });
          }
        },
      ),
      { numRuns: 25 },
    );
  });
});
