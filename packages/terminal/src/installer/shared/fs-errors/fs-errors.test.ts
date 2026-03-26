import { describe, expect, it } from 'vitest';

import { hasErrorCode } from './fs-errors.js';

describe('hasErrorCode', () => {
  it('returns true for an Error with matching code', () => {
    const err = Object.assign(new Error('fail'), { code: 'ENOENT' });
    expect(hasErrorCode(err, 'ENOENT')).toBe(true);
  });

  it('returns false for an Error with a different code', () => {
    const err = Object.assign(new Error('fail'), { code: 'EACCES' });
    expect(hasErrorCode(err, 'ENOENT')).toBe(false);
  });

  it('returns false for an Error with no code property', () => {
    expect(hasErrorCode(new Error('fail'), 'ENOENT')).toBe(false);
  });

  it('returns false for a non-Error value', () => {
    expect(hasErrorCode({ code: 'ENOENT' }, 'ENOENT')).toBe(false);
  });

  it('returns false for null', () => {
    expect(hasErrorCode(null, 'ENOENT')).toBe(false);
  });

  it('returns false for a string', () => {
    expect(hasErrorCode('ENOENT', 'ENOENT')).toBe(false);
  });
});
