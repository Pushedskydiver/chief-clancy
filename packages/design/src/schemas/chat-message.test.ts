import type { ChatMessage } from './chat-message.js';

import { describe, expect, it } from 'vitest';
import { z } from 'zod/mini';

import { chatMessageSchema } from './chat-message.js';

const pageLevel: ChatMessage = {
  ts: '2026-07-24T12:00:00.000Z',
  kind: 'user',
  body: 'make a pricing page hero',
};

const elementScoped: ChatMessage = {
  ts: '2026-07-24T12:00:05.000Z',
  kind: 'user',
  body: '[a7dH24] h1.header create 3 colour variants',
  threadRef: 'a7dH24',
  slotRef: 'h1.header',
};

describe('chatMessageSchema', () => {
  it('parses a §2.8-shaped page-level chat line (no thread/slot refs)', () => {
    expect(z.parse(chatMessageSchema, pageLevel)).toEqual(pageLevel);
  });

  it('parses a §2.8-shaped element-scoped chat line (thread + slot refs)', () => {
    expect(z.parse(chatMessageSchema, elementScoped)).toEqual(elementScoped);
  });

  it('rejects a kind outside user | assistant', () => {
    expect(
      z.safeParse(chatMessageSchema, { ...pageLevel, kind: 'system' }).success,
    ).toBe(false);

    // Control: the identical shape with a valid kind parses — proving the
    // rejection is driven by `kind`, not an unrelated field. A stray author
    // therefore surfaces on read rather than being silently ignored.
    expect(
      z.safeParse(chatMessageSchema, { ...pageLevel, kind: 'assistant' })
        .success,
    ).toBe(true);
  });

  it('treats threadRef and slotRef as optional string refs', () => {
    // Page-level omits both entirely — that is the valid shape, not a
    // defaulted-to-empty one.
    expect('threadRef' in z.parse(chatMessageSchema, pageLevel)).toBe(false);

    // A non-string ref is rejected (control below isolates it to threadRef).
    expect(
      z.safeParse(chatMessageSchema, { ...pageLevel, threadRef: 7 }).success,
    ).toBe(false);
    expect(
      z.safeParse(chatMessageSchema, { ...pageLevel, threadRef: 'a7dH24' })
        .success,
    ).toBe(true);
  });

  it('preserves unknown keys so a later slice can extend the line shape', () => {
    const withExtras = { ...pageLevel, futureField: 'kept' };

    expect(z.parse(chatMessageSchema, withExtras)).toEqual(withExtras);
  });
});
