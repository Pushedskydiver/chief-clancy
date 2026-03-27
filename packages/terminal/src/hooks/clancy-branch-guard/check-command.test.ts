import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { buildProtectedBranches, checkCommand } from './check-command.js';

const DEFAULT_BRANCHES = buildProtectedBranches(undefined);

// ---------------------------------------------------------------------------
// buildProtectedBranches
// ---------------------------------------------------------------------------

describe('buildProtectedBranches', () => {
  it('returns default branches when no env branch is set', () => {
    expect(buildProtectedBranches(undefined)).toStrictEqual([
      'main',
      'master',
      'develop',
    ]);
  });

  it('appends env branch when not already in the list', () => {
    const result = buildProtectedBranches('release');
    expect(result).toContain('release');
    expect(result).toHaveLength(4);
  });

  it('does not duplicate when env branch is already in the list', () => {
    const result = buildProtectedBranches('main');
    expect(result).toStrictEqual(['main', 'master', 'develop']);
  });
});

// ---------------------------------------------------------------------------
// checkCommand — git push --force
// ---------------------------------------------------------------------------

describe('checkCommand — force push', () => {
  it('blocks git push --force', () => {
    expect(checkCommand('git push --force', DEFAULT_BRANCHES)).toContain(
      'force push',
    );
  });

  it('blocks git push -f', () => {
    expect(checkCommand('git push -f', DEFAULT_BRANCHES)).toContain(
      'force push',
    );
  });

  it('allows git push --force-with-lease', () => {
    expect(
      checkCommand('git push --force-with-lease', DEFAULT_BRANCHES),
    ).toBeNull();
  });

  it('allows a normal git push', () => {
    expect(
      checkCommand('git push origin feature/x', DEFAULT_BRANCHES),
    ).toBeNull();
  });

  it('does not false-positive on -f after a command separator', () => {
    const cmd = 'git push origin feature && rm -f temp';
    expect(checkCommand(cmd, DEFAULT_BRANCHES)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// checkCommand — git push to protected branch
// ---------------------------------------------------------------------------

describe('checkCommand — push to protected branch', () => {
  it('blocks git push origin main', () => {
    expect(checkCommand('git push origin main', DEFAULT_BRANCHES)).toContain(
      'protected branch',
    );
  });

  it('blocks git push origin master', () => {
    expect(checkCommand('git push origin master', DEFAULT_BRANCHES)).toContain(
      'protected branch',
    );
  });

  it('blocks git push -u origin develop', () => {
    expect(
      checkCommand('git push -u origin develop', DEFAULT_BRANCHES),
    ).toContain('protected branch');
  });

  it('blocks git push origin main:main', () => {
    expect(
      checkCommand('git push origin main:main', DEFAULT_BRANCHES),
    ).toContain('protected branch');
  });

  it('allows git push origin main-feature (not exact match)', () => {
    expect(
      checkCommand('git push origin main-feature', DEFAULT_BRANCHES),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// checkCommand — git reset --hard
// ---------------------------------------------------------------------------

describe('checkCommand — reset hard', () => {
  it('blocks git reset --hard', () => {
    expect(checkCommand('git reset --hard', DEFAULT_BRANCHES)).toContain(
      'reset --hard',
    );
  });

  it('blocks git reset --hard HEAD~1', () => {
    expect(checkCommand('git reset --hard HEAD~1', DEFAULT_BRANCHES)).toContain(
      'reset --hard',
    );
  });
});

// ---------------------------------------------------------------------------
// checkCommand — git clean
// ---------------------------------------------------------------------------

describe('checkCommand — git clean', () => {
  it('blocks git clean -f', () => {
    expect(checkCommand('git clean -f', DEFAULT_BRANCHES)).toContain(
      'git clean -f',
    );
  });

  it('blocks git clean -fd', () => {
    expect(checkCommand('git clean -fd', DEFAULT_BRANCHES)).toContain(
      'git clean -f',
    );
  });

  it('allows git clean -fn (dry run)', () => {
    expect(checkCommand('git clean -fn', DEFAULT_BRANCHES)).toBeNull();
  });

  it('allows git clean -n', () => {
    expect(checkCommand('git clean -n', DEFAULT_BRANCHES)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// checkCommand — git checkout -- .
// ---------------------------------------------------------------------------

describe('checkCommand — checkout discard', () => {
  it('blocks git checkout -- .', () => {
    expect(checkCommand('git checkout -- .', DEFAULT_BRANCHES)).toContain(
      'checkout -- .',
    );
  });
});

// ---------------------------------------------------------------------------
// checkCommand — git restore .
// ---------------------------------------------------------------------------

describe('checkCommand — restore all', () => {
  it('blocks git restore .', () => {
    expect(checkCommand('git restore .', DEFAULT_BRANCHES)).toContain(
      'restore .',
    );
  });

  it('allows git restore ./specific-file', () => {
    expect(
      checkCommand('git restore ./specific-file', DEFAULT_BRANCHES),
    ).toBeNull();
  });

  it('allows git restore --staged . (intentional — staging area only)', () => {
    expect(checkCommand('git restore --staged .', DEFAULT_BRANCHES)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// checkCommand — git branch -D
// ---------------------------------------------------------------------------

describe('checkCommand — branch force delete', () => {
  it('blocks git branch -D feature', () => {
    expect(checkCommand('git branch -D feature', DEFAULT_BRANCHES)).toContain(
      'branch -D',
    );
  });

  it('allows git branch -d feature (lowercase)', () => {
    expect(checkCommand('git branch -d feature', DEFAULT_BRANCHES)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// checkCommand — edge cases
// ---------------------------------------------------------------------------

describe('checkCommand — edge cases', () => {
  it('returns null for empty string', () => {
    expect(checkCommand('', DEFAULT_BRANCHES)).toBeNull();
  });

  it('returns null for non-git command', () => {
    expect(checkCommand('npm install', DEFAULT_BRANCHES)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe('checkCommand — property-based', () => {
  it('never blocks arbitrary strings that do not contain "git"', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.includes('git')),
        (cmd) => {
          expect(checkCommand(cmd, DEFAULT_BRANCHES)).toBeNull();
        },
      ),
    );
  });

  it('always blocks "git push --force" with any suffix', () => {
    fc.assert(
      fc.property(fc.string(), (suffix) => {
        const cmd = `git push --force ${suffix}`;
        const result = checkCommand(cmd, DEFAULT_BRANCHES);
        const isForceWithLease = suffix.includes('--force-with-lease');

        if (!isForceWithLease) {
          expect(result).toContain('force push');
        }
      }),
    );
  });
});
