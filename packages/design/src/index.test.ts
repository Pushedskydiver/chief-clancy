import { describe, expect, it } from 'vitest';

import { PACKAGE_NAME, version } from './index.js';

describe('design', () => {
  it('exports the package name', () => {
    expect(PACKAGE_NAME).toBe('@chief-clancy/design');
  });

  it('exports a version string', () => {
    expect(version).toBeDefined();
    expect(typeof version).toBe('string');
  });
});
