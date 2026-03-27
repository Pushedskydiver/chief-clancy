import { describe, expect, it } from 'vitest';

import { buildCompactContext } from './build-context.js';

describe('buildCompactContext', () => {
  it('builds a full context string with all fields', () => {
    const lock = {
      ticketKey: 'PROJ-42',
      ticketTitle: 'Add auth middleware',
      ticketBranch: 'feature/auth',
      targetBranch: 'main',
      parentKey: 'PROJ-10',
      description: 'Implement OAuth flow',
    };

    const result = buildCompactContext(lock);

    expect(result).toContain('PROJ-42');
    expect(result).toContain('Add auth middleware');
    expect(result).toContain('feature/auth');
    expect(result).toContain('targeting main');
    expect(result).toContain('Parent: PROJ-10');
    expect(result).toContain('Implement OAuth flow');
    expect(result).toContain('Continue your implementation');
  });

  it('returns null when ticketKey is missing', () => {
    const lock = { ticketBranch: 'feature/x' };

    expect(buildCompactContext(lock)).toBeNull();
  });

  it('returns null when ticketBranch is missing', () => {
    const lock = { ticketKey: 'PROJ-1' };

    expect(buildCompactContext(lock)).toBeNull();
  });

  it('omits parent line when parentKey is undefined', () => {
    const lock = {
      ticketKey: 'PROJ-1',
      ticketBranch: 'feature/x',
      targetBranch: 'main',
    };

    const result = buildCompactContext(lock);

    expect(result).not.toBeNull();
    expect(result).not.toContain('Parent:');
  });

  it('omits parent line when parentKey is "none"', () => {
    const lock = {
      ticketKey: 'PROJ-1',
      ticketBranch: 'feature/x',
      targetBranch: 'main',
      parentKey: 'none',
    };

    const result = buildCompactContext(lock);

    expect(result).not.toContain('Parent:');
  });

  it('omits requirements line when description is undefined', () => {
    const lock = {
      ticketKey: 'PROJ-1',
      ticketBranch: 'feature/x',
      targetBranch: 'main',
    };

    const result = buildCompactContext(lock);

    expect(result).not.toContain('Requirements:');
  });

  it('truncates description to 2000 characters', () => {
    const lock = {
      ticketKey: 'PROJ-1',
      ticketBranch: 'feature/x',
      targetBranch: 'main',
      description: 'a'.repeat(3000),
    };

    const result = buildCompactContext(lock);

    expect(result).not.toBeNull();

    const requirementsLine = result!
      .split('\n')
      .find((l) => l.startsWith('Requirements:'));

    expect(requirementsLine).toBeDefined();
    expect(requirementsLine!.length).toBeLessThanOrEqual(
      'Requirements: '.length + 2000,
    );
  });

  it('returns null when ticketKey is empty string', () => {
    expect(
      buildCompactContext({ ticketKey: '', ticketBranch: 'x' }),
    ).toBeNull();
  });

  it('returns null when ticketBranch is empty string', () => {
    expect(
      buildCompactContext({ ticketKey: 'X', ticketBranch: '' }),
    ).toBeNull();
  });

  it('defaults targetBranch to main when absent', () => {
    const lock = { ticketKey: 'PROJ-1', ticketBranch: 'feature/x' };

    const result = buildCompactContext(lock);

    expect(result).toContain('targeting main');
  });
});
