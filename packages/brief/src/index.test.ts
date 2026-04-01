import { describe, expect, it } from 'vitest';

import { PACKAGE_NAME } from './index.js';

describe('brief', () => {
  it('exports the package name', () => {
    expect(PACKAGE_NAME).toBe('@chief-clancy/brief');
  });
});
