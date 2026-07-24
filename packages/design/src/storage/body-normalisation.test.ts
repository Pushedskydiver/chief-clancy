import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { toChatBody, toThreadBody } from './body-normalisation.js';

describe('chat ↔ thread body normalisation (§2.8)', () => {
  it('tags the chat body with the [threadId] slot prefix', () => {
    // Exactly the §2.8 element-scoped example line.
    expect(toChatBody('a7dH24', 'h1.header', 'create 3 colour variants')).toBe(
      '[a7dH24] h1.header create 3 colour variants',
    );
  });

  it('strips the prefix back to the bare thread body', () => {
    expect(
      toThreadBody(
        'a7dH24',
        'h1.header',
        '[a7dH24] h1.header create 3 colour variants',
      ),
    ).toBe('create 3 colour variants');
  });

  it('throws when the chat body is not tagged for the given thread and slot', () => {
    // A page-level body has no prefix at all; a body tagged for a *different*
    // thread would strip the wrong number of characters, so a mismatch is
    // corruption to surface rather than silently return the input unchanged.
    expect(() =>
      toThreadBody('a7dH24', 'h1.header', 'change the overall aesthetic'),
    ).toThrow(/not tagged/);
    expect(() =>
      toThreadBody('a7dH24', 'h1.header', '[b9kQ11] h1.header hello'),
    ).toThrow(/not tagged/);
    expect(() =>
      toThreadBody('a7dH24', 'h1.header', '[a7dH24] button.cta hello'),
    ).toThrow(/not tagged/);
  });

  it('round-trips any body through toChatBody → toThreadBody unchanged', () => {
    const threadId = fc
      .array(fc.constantFrom(...'abcXYZ019_-'.split('')), {
        minLength: 1,
        maxLength: 10,
      })
      .map((chars) => chars.join(''));

    // A body that itself contains the delimiter characters — brackets,
    // spaces, even a leading copy of a prefix — must still round-trip,
    // because toThreadBody slices an exact prefix length rather than parsing
    // brackets out. The spaced/combinator slots prove the same for slots.
    const messyBody = fc
      .array(
        fc.constantFrom('a', '\n', '"', '\\', '\t', '😀', '[', ']', ' ', ''),
        { maxLength: 16 },
      )
      .map((parts) => parts.join(''));

    fc.assert(
      fc.property(
        threadId,
        fc.constantFrom('h1.header', 'button.cta', 'div p', 'nav > ul li'),
        messyBody,
        (id, slot, body) => {
          expect(toThreadBody(id, slot, toChatBody(id, slot, body))).toBe(body);
        },
      ),
    );
  });
});
