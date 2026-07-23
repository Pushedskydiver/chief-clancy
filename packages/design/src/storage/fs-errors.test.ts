import { describe, expect, it } from 'vitest';

import { isNodeFsError } from './fs-errors.js';

describe('isNodeFsError', () => {
  it('narrows a real fs rejection so its code can be read', () => {
    const err: unknown = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });

    expect(isNodeFsError(err)).toBe(true);
    // The whole point of the guard: `.code` is reachable after it.
    expect(isNodeFsError(err) && err.code).toBe('ENOENT');
  });

  it('accepts a code-bearing plain object, not just an Error instance', () => {
    // The `canvas/server/lock.ts` variant uses `instanceof Error` and would
    // reject this; the two guards are not interchangeable.
    expect(isNodeFsError({ code: 'EISDIR' })).toBe(true);
  });

  it('rejects values with no code, so a non-fs throw is never mistaken for one', () => {
    expect(isNodeFsError(new Error('plain'))).toBe(false);
    expect(isNodeFsError(null)).toBe(false);
    expect(isNodeFsError(undefined)).toBe(false);
    expect(isNodeFsError('ENOENT')).toBe(false);
  });
});
