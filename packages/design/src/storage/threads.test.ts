import type { ThreadMessage } from '../schemas/thread-message.js';

import { appendFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { appendThreadMessage, readThreadMessages } from './threads.js';

const makeMessage = (
  kind: ThreadMessage['kind'],
  body: string,
  ts: string,
): ThreadMessage => ({
  ts,
  kind,
  slot: 'h1.header',
  tag: 'h1',
  textSnippet: 'Welcome to Pricing',
  status: 'active',
  body,
});

describe('JSONL thread persistence', () => {
  let sessionDir: string;

  beforeEach(async () => {
    sessionDir = await mkdtemp(join(tmpdir(), 'clancy-design-threads-'));
  });

  afterEach(async () => {
    await rm(sessionDir, { recursive: true, force: true });
  });

  it('appends 3 messages to threads/{threadId}.jsonl and reads them back in order', async () => {
    const first = makeMessage(
      'user',
      'create 3 colour variants',
      '2026-07-23T12:00:00.000Z',
    );
    const second = makeMessage(
      'assistant',
      'done — purple, green, blue',
      '2026-07-23T12:00:05.000Z',
    );
    const third = makeMessage(
      'user',
      'lock the purple one',
      '2026-07-23T12:01:00.000Z',
    );

    await appendThreadMessage(sessionDir, 'a7dH24', first);
    await appendThreadMessage(sessionDir, 'a7dH24', second);
    await appendThreadMessage(sessionDir, 'a7dH24', third);

    expect(await readThreadMessages(sessionDir, 'a7dH24')).toEqual([
      first,
      second,
      third,
    ]);
  });

  it('returns an empty list when the thread has no file yet', async () => {
    expect(await readThreadMessages(sessionDir, 'never-written')).toEqual([]);
  });

  it('skips a truncated last line left by a crash mid-append', async () => {
    const first = makeMessage(
      'user',
      'persisted cleanly',
      '2026-07-23T12:00:00.000Z',
    );
    await appendThreadMessage(sessionDir, 'a7dH24', first);

    // Simulate a process crash mid-write: a partial JSON line, no trailing newline.
    await appendFile(
      join(sessionDir, 'threads', 'a7dH24.jsonl'),
      '{"ts":"2026-07-23T12:00:05.000Z","kind":"assistant","slot"',
      'utf8',
    );

    expect(await readThreadMessages(sessionDir, 'a7dH24')).toEqual([first]);
  });

  it('throws on unparseable JSON that is not the torn tail', async () => {
    // Same corruption as the test above, one position earlier: this line was
    // framed by a newline, so it was written whole and the crash story
    // doesn't explain it.
    const first = makeMessage('user', 'first', '2026-07-23T12:00:00.000Z');
    await appendThreadMessage(sessionDir, 'a7dH24', first);
    await appendFile(
      join(sessionDir, 'threads', 'a7dH24.jsonl'),
      '{ not json\n',
      'utf8',
    );
    await appendThreadMessage(
      sessionDir,
      'a7dH24',
      makeMessage('user', 'third', '2026-07-23T12:00:02.000Z'),
    );

    await expect(readThreadMessages(sessionDir, 'a7dH24')).rejects.toThrow(
      SyntaxError,
    );
  });

  it('throws on a schema-invalid line instead of dropping that message', async () => {
    // The failure mode this guards: a dropped line is a user comment that
    // silently never reaches the regeneration prompt.
    const first = makeMessage('user', 'first', '2026-07-23T12:00:00.000Z');
    await appendThreadMessage(sessionDir, 'a7dH24', first);
    await appendFile(
      join(sessionDir, 'threads', 'a7dH24.jsonl'),
      JSON.stringify({ ...first, status: 'resolved' }) + '\n',
      'utf8',
    );
    await appendThreadMessage(
      sessionDir,
      'a7dH24',
      makeMessage('user', 'third', '2026-07-23T12:00:02.000Z'),
    );

    await expect(
      readThreadMessages(sessionDir, 'a7dH24'),
    ).rejects.toMatchObject({ name: '$ZodError' });
  });

  it('throws on a schema-invalid final line when the file ends in a newline', async () => {
    // Newline-terminated, so the write completed — the torn-tail exemption
    // is positional AND conditional, and must not cover this.
    await mkdir(join(sessionDir, 'threads'), { recursive: true });
    await appendFile(
      join(sessionDir, 'threads', 'a7dH24.jsonl'),
      JSON.stringify({
        ...makeMessage('user', 'bad kind', '2026-07-23T12:00:00.000Z'),
        kind: 'system',
      }) + '\n',
      'utf8',
    );

    await expect(
      readThreadMessages(sessionDir, 'a7dH24'),
    ).rejects.toMatchObject({ name: '$ZodError' });
  });

  it('throws on a schema-invalid final line even with no trailing newline', async () => {
    // A torn write leaves *unparseable* bytes. Valid JSON that fails the
    // schema is version skew, so the missing newline doesn't excuse it —
    // otherwise the last message in every thread is silently droppable.
    const first = makeMessage('user', 'first', '2026-07-23T12:00:00.000Z');
    await appendThreadMessage(sessionDir, 'a7dH24', first);
    await appendFile(
      join(sessionDir, 'threads', 'a7dH24.jsonl'),
      JSON.stringify({ ...first, status: 'resolved' }),
      'utf8',
    );

    await expect(
      readThreadMessages(sessionDir, 'a7dH24'),
    ).rejects.toMatchObject({ name: '$ZodError' });
  });

  it('rejects a message that does not satisfy the schema before writing it', async () => {
    // The cast is the point: this asserts the runtime guard for a caller that
    // assembled the record from untyped input, which the type can't cover.
    const invalid = {
      ...makeMessage('user', 'bad status', '2026-07-23T12:00:00.000Z'),
      status: 'resolved',
    } as unknown as ThreadMessage;

    await expect(
      appendThreadMessage(sessionDir, 'a7dH24', invalid),
    ).rejects.toMatchObject({ name: '$ZodError' });

    // Nothing was written, so the thread is still empty rather than unreadable.
    expect(await readThreadMessages(sessionDir, 'a7dH24')).toEqual([]);
  });

  it('rejects a threadId that is not a single id-shaped path segment', async () => {
    const message = makeMessage('user', 'evil', '2026-07-23T12:00:00.000Z');
    // `x/../y` would otherwise normalise onto thread `y`; `''` would open a
    // real file named `.jsonl`; `sub/thread` would nest a directory.
    const rejected = ['../../evil', 'x/../y', '', 'sub/thread', '.'];

    await Promise.all(
      rejected.flatMap((threadId) => [
        expect(
          appendThreadMessage(sessionDir, threadId, message),
        ).rejects.toThrow(/is not a valid thread id/),
        expect(readThreadMessages(sessionDir, threadId)).rejects.toThrow(
          /is not a valid thread id/,
        ),
      ]),
    );
  });

  it('rethrows a non-ENOENT read error instead of reporting an empty thread', async () => {
    // Make the target path a directory so readFile rejects with EISDIR — a
    // non-ENOENT error that must propagate, not be swallowed as "no messages".
    await mkdir(join(sessionDir, 'threads', 'a7dH24.jsonl'), {
      recursive: true,
    });

    await expect(
      readThreadMessages(sessionDir, 'a7dH24'),
    ).rejects.toMatchObject({ code: 'EISDIR' });
  });

  it('round-trips arbitrary message text through the JSONL framing', async () => {
    // The framing risk is a body containing the record delimiter. `fc.string()`
    // is printable-ASCII by default and emits no newline at all (measured: 0 in
    // 2000 samples), so the alphabet is spelled out to guarantee the delimiter,
    // the JSON escapes, and a multi-byte char actually show up.
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
            kind: fc.constantFrom<ThreadMessage['kind']>('user', 'assistant'),
            body: messyText,
            textSnippet: messyText,
          }),
          { minLength: 1, maxLength: 8 },
        ),
        async (drafts) => {
          const dir = await mkdtemp(
            join(tmpdir(), 'clancy-design-threads-fc-'),
          );
          try {
            const messages = drafts.map(
              (draft, index): ThreadMessage => ({
                ...makeMessage(
                  draft.kind,
                  draft.body,
                  `2026-07-23T12:00:0${index}.000Z`,
                ),
                textSnippet: draft.textSnippet,
              }),
            );

            await messages.reduce(async (previous, message) => {
              await previous;
              await appendThreadMessage(dir, 'a7dH24', message);
            }, Promise.resolve());

            expect(await readThreadMessages(dir, 'a7dH24')).toEqual(messages);
          } finally {
            await rm(dir, { recursive: true, force: true });
          }
        },
      ),
      { numRuns: 25 },
    );
  });

  it('keeps threads in separate files so one thread never reads another', async () => {
    const header = makeMessage(
      'user',
      'header comment',
      '2026-07-23T12:00:00.000Z',
    );
    const cta: ThreadMessage = {
      ...makeMessage('user', 'cta comment', '2026-07-23T12:00:01.000Z'),
      slot: 'button.cta',
      tag: 'button',
      textSnippet: 'Start free trial',
    };

    await appendThreadMessage(sessionDir, 'a7dH24', header);
    await appendThreadMessage(sessionDir, 'b9kQ11', cta);

    expect(await readThreadMessages(sessionDir, 'a7dH24')).toEqual([header]);
    expect(await readThreadMessages(sessionDir, 'b9kQ11')).toEqual([cta]);
  });
});
