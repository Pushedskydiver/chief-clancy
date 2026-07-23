import type { ElementState } from '../schemas/element-state.js';

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readElementState, writeElementState } from './elements.js';

const state: ElementState = {
  slot: 'h1.header',
  threadId: 'a7dH24',
  rounds: [
    {
      roundId: 'r1',
      variants: [
        { id: 'A1', sha: 'sha-a1', isLocked: true, status: 'ready' },
        { id: 'A2', sha: 'sha-a2', isLocked: false, status: 'generating' },
      ],
    },
  ],
  softSelected: 'A1',
  accepted: null,
};

describe('element-state persistence', () => {
  let sessionDir: string;

  beforeEach(async () => {
    sessionDir = await mkdtemp(join(tmpdir(), 'clancy-design-elements-'));
  });

  afterEach(async () => {
    await rm(sessionDir, { recursive: true, force: true });
  });

  it('writes elements/{slot}.json and reads the state back', async () => {
    await writeElementState(sessionDir, 'h1.header', state);

    const loaded = await readElementState(sessionDir, 'h1.header');

    expect(loaded).toEqual(state);
  });

  it('returns null when no state has been written for the slot', async () => {
    const loaded = await readElementState(sessionDir, 'never.written');

    expect(loaded).toBeNull();
  });

  it('overwrites the file wholesale on the second write (mutable state, not append)', async () => {
    await writeElementState(sessionDir, 'h1.header', state);

    const next: ElementState = {
      ...state,
      softSelected: 'A2',
      accepted: {
        variantId: 'A2',
        roundId: 'r1',
        ts: '2026-07-23T12:00:00.000Z',
      },
    };
    await writeElementState(sessionDir, 'h1.header', next);

    const loaded = await readElementState(sessionDir, 'h1.header');
    expect(loaded).toEqual(next);
  });

  it('rejects a slot shaped to escape the elements dir via path traversal', async () => {
    await expect(
      writeElementState(sessionDir, '../../evil', state),
    ).rejects.toThrow(/resolves outside the elements dir/);

    await expect(readElementState(sessionDir, '../../evil')).rejects.toThrow(
      /resolves outside the elements dir/,
    );
  });
});
