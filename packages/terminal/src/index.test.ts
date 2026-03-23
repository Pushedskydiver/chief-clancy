import { describe, expect, it } from 'vitest';

import { CORE_PACKAGE_NAME, PACKAGE_NAME } from './index.js';

describe('terminal', () => {
  it('exports the package name', () => {
    expect(PACKAGE_NAME).toBe('@chief-clancy/terminal');
  });

  it('re-exports core package name', () => {
    expect(CORE_PACKAGE_NAME).toBe('@chief-clancy/core');
  });
});
