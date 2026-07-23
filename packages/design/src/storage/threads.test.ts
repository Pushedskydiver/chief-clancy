import type { ThreadMessage } from '../schemas/thread-message.js';

import { appendFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

  it('rejects a threadId shaped to escape the threads dir via path traversal', async () => {
    const message = makeMessage('user', 'evil', '2026-07-23T12:00:00.000Z');

    await expect(
      appendThreadMessage(sessionDir, '../../evil', message),
    ).rejects.toThrow(/resolves outside the threads dir/);

    await expect(readThreadMessages(sessionDir, '../../evil')).rejects.toThrow(
      /resolves outside the threads dir/,
    );
  });

  it('rethrows a non-ENOENT read error instead of reporting an empty thread', async () => {
    // Make the target path a directory so readFile rejects with EISDIR — a
    // non-ENOENT error that must propagate, not be swallowed as "no messages".
    await mkdir(join(sessionDir, 'threads', 'a7dH24.jsonl'), {
      recursive: true,
    });

    await expect(readThreadMessages(sessionDir, 'a7dH24')).rejects.toThrow();
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
