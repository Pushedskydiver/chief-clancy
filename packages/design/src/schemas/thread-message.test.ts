import type { ThreadMessage } from './thread-message.js';

import { describe, expect, it } from 'vitest';
import { z } from 'zod/mini';

import { threadMessageSchema } from './thread-message.js';

const base: ThreadMessage = {
  ts: '2026-07-23T12:00:00.000Z',
  kind: 'user',
  slot: 'h1.header',
  tag: 'h1',
  textSnippet: 'Welcome to Pricing',
  status: 'active',
  body: 'create 3 colour variants',
};

describe('threadMessageSchema', () => {
  it('parses a §2.8-shaped thread line', () => {
    expect(z.parse(threadMessageSchema, base)).toEqual(base);
  });

  it('accepts every anchor-lifecycle status in the §2.8 progression', () => {
    const statuses = ['active', 'stale', 'reanchored'] as const;
    const lines = statuses.map((status) => ({ ...base, status }));

    expect(lines.map((line) => z.parse(threadMessageSchema, line))).toEqual(
      lines,
    );
  });

  it('rejects a status outside active | stale | reanchored', () => {
    expect(
      z.safeParse(threadMessageSchema, { ...base, status: 'resolved' }).success,
    ).toBe(false);

    // Control: the identical shape with a valid status parses — proving the
    // rejection is driven by `status`, not an unrelated field.
    expect(
      z.safeParse(threadMessageSchema, { ...base, status: 'stale' }).success,
    ).toBe(true);
  });

  it('rejects a kind outside user | assistant', () => {
    expect(
      z.safeParse(threadMessageSchema, { ...base, kind: 'system' }).success,
    ).toBe(false);

    // Control, as above — isolates the rejection to `kind`.
    expect(
      z.safeParse(threadMessageSchema, { ...base, kind: 'assistant' }).success,
    ).toBe(true);
  });

  it('preserves unknown keys so a later slice can extend the line shape', () => {
    const withExtras = { ...base, futureField: 'kept' };

    expect(z.parse(threadMessageSchema, withExtras)).toEqual(withExtras);
  });
});
