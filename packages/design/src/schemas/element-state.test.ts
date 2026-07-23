import type { ElementState } from './element-state.js';

import { describe, expect, it } from 'vitest';
import { z } from 'zod/mini';

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

    expect(z.parse(elementStateSchema, accepted)).toEqual(accepted);
  });

  it('rejects a variant status outside generating | ready | failed', () => {
    const withBadStatus = {
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
    expect(z.safeParse(elementStateSchema, withBadStatus).success).toBe(false);

    // Control: the identical shape with a valid status parses — proving the
    // rejection is driven by `status`, not an unrelated field.
    const withValidStatus = {
      ...withBadStatus,
      rounds: [
        {
          roundId: 'r1',
          variants: [
            { id: 'A1', sha: 'sha-a1', isLocked: false, status: 'failed' },
          ],
        },
      ],
    };
    expect(z.safeParse(elementStateSchema, withValidStatus).success).toBe(true);
  });

  it('preserves unknown keys at every level so a later slice can extend the shape', () => {
    const withExtras = {
      ...base,
      futureField: 'kept',
      rounds: [
        {
          roundId: 'r1',
          roundExtra: 'kept',
          variants: [
            {
              id: 'A1',
              sha: 'sha-a1',
              isLocked: false,
              status: 'ready',
              variantExtra: 'kept',
            },
          ],
        },
      ],
    };

    expect(z.parse(elementStateSchema, withExtras)).toEqual(withExtras);
  });
});
