import { PassThrough } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { readAsyncInput, readPreToolUseInput } from './stdin-reader.js';

describe('readPreToolUseInput', () => {
  it('parses valid JSON from argv[2]', () => {
    const json = JSON.stringify({ tool_name: 'Bash' });
    const deps = { argv: ['node', 'hook.js', json], readFileSync: () => '' };

    expect(readPreToolUseInput(deps)).toStrictEqual({ tool_name: 'Bash' });
  });

  it('returns empty object for malformed JSON in argv[2]', () => {
    const deps = {
      argv: ['node', 'hook.js', '{broken'],
      readFileSync: () => '',
    };

    expect(readPreToolUseInput(deps)).toStrictEqual({});
  });

  it('falls back to readFileSync when argv[2] is absent', () => {
    const json = JSON.stringify({ session_id: 'abc' });
    const deps = { argv: ['node', 'hook.js'], readFileSync: () => json };

    expect(readPreToolUseInput(deps)).toStrictEqual({ session_id: 'abc' });
  });

  it('returns empty object when both sources fail', () => {
    const deps = {
      argv: ['node', 'hook.js'],
      readFileSync: () => {
        throw new Error('no stdin');
      },
    };

    expect(readPreToolUseInput(deps)).toStrictEqual({});
  });

  it('returns empty object for JSON number', () => {
    const deps = { argv: ['node', 'hook.js', '42'], readFileSync: () => '' };

    expect(readPreToolUseInput(deps)).toStrictEqual({});
  });

  it('returns empty object for JSON string', () => {
    const deps = {
      argv: ['node', 'hook.js', '"hello"'],
      readFileSync: () => '',
    };

    expect(readPreToolUseInput(deps)).toStrictEqual({});
  });

  it('returns empty object for JSON array', () => {
    const deps = {
      argv: ['node', 'hook.js', '[1,2,3]'],
      readFileSync: () => '',
    };

    expect(readPreToolUseInput(deps)).toStrictEqual({});
  });
});

describe('readAsyncInput', () => {
  it('resolves to parsed data from stdin chunks', async () => {
    const stream = new PassThrough();
    const promise = readAsyncInput({ stdin: stream });

    stream.write('{"session');
    stream.write('_id":"x"}');
    stream.end();

    expect(await promise).toStrictEqual({ session_id: 'x' });
  });

  it('resolves to empty object on timeout', async () => {
    const stream = new PassThrough();
    const promise = readAsyncInput({ stdin: stream, timeoutMs: 10 });

    expect(await promise).toStrictEqual({});
  });

  it('resolves to empty object on invalid JSON', async () => {
    const stream = new PassThrough();
    const promise = readAsyncInput({ stdin: stream });

    stream.write('not json');
    stream.end();

    expect(await promise).toStrictEqual({});
  });
});
