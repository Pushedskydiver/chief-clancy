import type { ElementState } from './element-state.js';

import { describe, expect, it } from 'vitest';

import { elementStateSchema } from './element-state.js';

const base: ElementState = {
  slot: 'h1.header',
  threadId: 'a7dH24',
  rounds: [
    {
      roundId: 'r1',
      variants: [{ id: 'A1', sha: 'sha-a1', isLocked: false, status: 'ready' }],
    },
  ],
  softSelected: 'A1',
  accepted: null,
};

describe('elementStateSchema', () => {
  it('parses a full §2.8-shaped element state including a populated accept pointer', () => {
    const accepted: ElementState = {
      ...base,
      accepted: {
        variantId: 'A1',
        roundId: 'r1',
        ts: '2026-07-23T12:00:00.000Z',
      },
    };

    expect(elementStateSchema.parse(accepted)).toEqual(accepted);
  });

  it('rejects a variant status outside generating | ready | failed', () => {
    const bad = {
      ...base,
      rounds: [
        {
          roundId: 'r1',
          variants: [
            { id: 'A1', sha: 'sha-a1', isLocked: false, status: 'done' },
          ],
        },
      ],
    };

    expect(() => elementStateSchema.parse(bad)).toThrow();
  });

  it('preserves unknown keys on parse so a later slice can extend the shape', () => {
    const withExtra = { ...base, futureField: 'kept' };

    expect(elementStateSchema.parse(withExtra)).toMatchObject({
      futureField: 'kept',
    });
  });
});
