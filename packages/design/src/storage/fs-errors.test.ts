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
    // This is the looser of the two shapes in the repo, and the minority one:
    // `instanceof Error && 'code' in err` is used at six sites, including
    // `canvas/server/lock.ts`, and would reject this input. Pinning the
    // difference so a future consolidation is a deliberate choice, not a
    // silent semantic change to the storage read paths.
    expect(isNodeFsError({ code: 'EISDIR' })).toBe(true);
  });

  it('rejects values with no code, so a non-fs throw is never mistaken for one', () => {
    expect(isNodeFsError(new Error('plain'))).toBe(false);
    expect(isNodeFsError(null)).toBe(false);
    expect(isNodeFsError(undefined)).toBe(false);
    expect(isNodeFsError('ENOENT')).toBe(false);
  });
});
