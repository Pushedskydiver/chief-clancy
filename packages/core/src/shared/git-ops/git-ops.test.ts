import { describe, expect, it, vi } from 'vitest';

import {
  branchExists,
  checkout,
  currentBranch,
  deleteBranch,
  detectRemote,
  diffAgainstBranch,
  ensureBranch,
  fetchRemoteBranch,
  hasUncommittedChanges,
  isSafeBranchName,
  pushBranch,
  remoteBranchExists,
  squashMerge,
} from './git-ops.js';

// ─── currentBranch ────────────────────────────────────────────────────

describe('currentBranch', () => {
  it('returns trimmed branch name from git rev-parse', () => {
    const exec = vi.fn().mockReturnValue('  main\n');

    expect(currentBranch(exec)).toBe('main');
    expect(exec).toHaveBeenCalledWith(['rev-parse', '--abbrev-ref', 'HEAD']);
  });
});

// ─── hasUncommittedChanges ────────────────────────────────────────────

describe('hasUncommittedChanges', () => {
  it('returns false when working directory is clean', () => {
    const exec = vi.fn().mockReturnValue('');

    expect(hasUncommittedChanges(exec)).toBe(false);
    expect(exec).toHaveBeenCalledWith(['diff', '--quiet']);
    expect(exec).toHaveBeenCalledWith(['diff', '--cached', '--quiet']);
  });

  it('returns true when unstaged changes exist', () => {
    const exec = vi.fn().mockImplementation((args: readonly string[]) => {
      if (args.includes('--cached')) return '';
      throw new Error('changes detected');
    });

    expect(hasUncommittedChanges(exec)).toBe(true);
  });

  it('returns true when staged changes exist', () => {
    const exec = vi.fn().mockImplementation((args: readonly string[]) => {
      if (args.includes('--cached')) throw new Error('staged changes');
      return '';
    });

    expect(hasUncommittedChanges(exec)).toBe(true);
  });
});

// ─── branchExists ─────────────────────────────────────────────────────

describe('branchExists', () => {
  it('returns true when branch exists', () => {
    const exec = vi.fn().mockReturnValue('');

    expect(branchExists(exec, 'main')).toBe(true);
    expect(exec).toHaveBeenCalledWith([
      'show-ref',
      '--verify',
      '--quiet',
      'refs/heads/main',
    ]);
  });

  it('returns false when branch does not exist', () => {
    const exec = vi.fn().mockImplementation(() => {
      throw new Error('not a ref');
    });

    expect(branchExists(exec, 'nonexistent')).toBe(false);
  });

  it('returns false for branch names with path traversal', () => {
    const exec = vi.fn();

    expect(branchExists(exec, '../../tags/v1.0')).toBe(false);
    expect(exec).not.toHaveBeenCalled();
  });

  it('returns false for empty branch name', () => {
    const exec = vi.fn();

    expect(branchExists(exec, '')).toBe(false);
    expect(exec).not.toHaveBeenCalled();
  });
});

// ─── isSafeBranchName ─────────────────────────────────────────────────

describe('isSafeBranchName', () => {
  it('returns true for valid branch names', () => {
    expect(isSafeBranchName('main')).toBe(true);
    expect(isSafeBranchName('feature/add-login')).toBe(true);
    expect(isSafeBranchName('epic/PROJ-100')).toBe(true);
  });

  it('returns false for names with path traversal', () => {
    expect(isSafeBranchName('../../tags/v1.0')).toBe(false);
    expect(isSafeBranchName('feature/../main')).toBe(false);
  });

  it('returns false for names starting with /', () => {
    expect(isSafeBranchName('/absolute')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isSafeBranchName('')).toBe(false);
  });
});

// ─── ensureBranch ─────────────────────────────────────────────────────

describe('ensureBranch', () => {
  it('creates branch when it does not exist', () => {
    const exec = vi.fn().mockImplementation((args: readonly string[]) => {
      if (args[0] === 'show-ref') throw new Error('not found');
      return '';
    });

    ensureBranch(exec, 'feature/x', 'main');
    expect(exec).toHaveBeenCalledWith(['checkout', '-b', 'feature/x', 'main']);
  });

  it('does nothing when branch already exists', () => {
    const exec = vi.fn().mockReturnValue('');

    ensureBranch(exec, 'feature/x', 'main');
    expect(exec).not.toHaveBeenCalledWith(expect.arrayContaining(['checkout']));
  });
});

// ─── checkout ─────────────────────────────────────────────────────────

describe('checkout', () => {
  it('checks out a branch', () => {
    const exec = vi.fn().mockReturnValue('');

    checkout(exec, 'main');
    expect(exec).toHaveBeenCalledWith(['checkout', 'main']);
  });

  it('uses -B flag when force is true', () => {
    const exec = vi.fn().mockReturnValue('');

    checkout(exec, 'feature/x', true);
    expect(exec).toHaveBeenCalledWith(['checkout', '-B', 'feature/x']);
  });
});

// ─── squashMerge ──────────────────────────────────────────────────────

describe('squashMerge', () => {
  it('returns true when changes are committed', () => {
    const exec = vi.fn().mockImplementation((args: readonly string[]) => {
      if (args[0] === 'diff') throw new Error('staged changes exist');
      return '';
    });

    expect(squashMerge(exec, 'feature/x', 'Merge feature')).toBe(true);
    expect(exec).toHaveBeenCalledWith(['merge', '--squash', 'feature/x']);
    expect(exec).toHaveBeenCalledWith(['commit', '-m', 'Merge feature']);
  });

  it('returns false when nothing to commit', () => {
    const exec = vi.fn().mockReturnValue('');

    expect(squashMerge(exec, 'feature/x', 'Merge feature')).toBe(false);
    expect(exec).not.toHaveBeenCalledWith(expect.arrayContaining(['commit']));
  });
});

// ─── deleteBranch ─────────────────────────────────────────────────────

describe('deleteBranch', () => {
  it('force-deletes a branch', () => {
    const exec = vi.fn().mockReturnValue('');

    deleteBranch(exec, 'feature/x');
    expect(exec).toHaveBeenCalledWith(['branch', '-D', 'feature/x']);
  });
});

// ─── remoteBranchExists ───────────────────────────────────────────────

describe('remoteBranchExists', () => {
  it('returns true when remote branch exists', () => {
    const exec = vi.fn().mockReturnValue('abc123\trefs/heads/epic/proj-100\n');

    expect(remoteBranchExists(exec, 'epic/proj-100')).toBe(true);
    expect(exec).toHaveBeenCalledWith([
      'ls-remote',
      '--heads',
      'origin',
      'epic/proj-100',
    ]);
  });

  it('returns false when output is empty', () => {
    const exec = vi.fn().mockReturnValue('');

    expect(remoteBranchExists(exec, 'nonexistent')).toBe(false);
  });

  it('returns false on network error', () => {
    const exec = vi.fn().mockImplementation(() => {
      throw new Error('Could not resolve host');
    });

    expect(remoteBranchExists(exec, 'epic/proj-100')).toBe(false);
  });
});

// ─── fetchRemoteBranch ────────────────────────────────────────────────

describe('fetchRemoteBranch', () => {
  it('returns true when fetch succeeds', () => {
    const exec = vi.fn().mockReturnValue('');

    expect(fetchRemoteBranch(exec, 'feature/proj-123')).toBe(true);
    expect(exec).toHaveBeenCalledWith([
      'fetch',
      'origin',
      'feature/proj-123:feature/proj-123',
    ]);
  });

  it('returns false when branch does not exist on remote', () => {
    const exec = vi.fn().mockImplementation(() => {
      throw new Error("couldn't find remote ref");
    });

    expect(fetchRemoteBranch(exec, 'nonexistent')).toBe(false);
  });
});

// ─── diffAgainstBranch ────────────────────────────────────────────────

describe('diffAgainstBranch', () => {
  it('returns stat output', () => {
    const stat = ' src/index.ts | 5 +++++\n 1 file changed';
    const exec = vi.fn().mockReturnValue(stat);

    expect(diffAgainstBranch(exec, 'main')).toBe(stat.trim());
    expect(exec).toHaveBeenCalledWith(['diff', 'main...HEAD', '--stat']);
  });

  it('returns undefined when output is empty', () => {
    const exec = vi.fn().mockReturnValue('   \n');

    expect(diffAgainstBranch(exec, 'main')).toBeUndefined();
  });

  it('truncates output exceeding maxLength', () => {
    const longOutput = 'x'.repeat(100);
    const exec = vi.fn().mockReturnValue(longOutput);

    const result = diffAgainstBranch(exec, 'main', 50);
    expect(result).toBe('x'.repeat(50) + '\n... (truncated)');
  });

  it('returns undefined on error', () => {
    const exec = vi.fn().mockImplementation(() => {
      throw new Error('unknown revision');
    });

    expect(diffAgainstBranch(exec, 'nonexistent')).toBeUndefined();
  });
});

// ─── pushBranch ───────────────────────────────────────────────────────

describe('pushBranch', () => {
  it('returns true when push succeeds', () => {
    const exec = vi.fn().mockReturnValue('');

    expect(pushBranch(exec, 'feature/proj-123')).toBe(true);
    expect(exec).toHaveBeenCalledWith([
      'push',
      '-u',
      'origin',
      'feature/proj-123',
    ]);
  });

  it('returns false when push fails', () => {
    const exec = vi.fn().mockImplementation(() => {
      throw new Error('permission denied');
    });

    expect(pushBranch(exec, 'feature/proj-123')).toBe(false);
  });
});

// ─── detectRemote ─────────────────────────────────────────────────────

describe('detectRemote', () => {
  it('returns parsed GitHub remote', () => {
    const exec = vi
      .fn()
      .mockReturnValue('git@github.com:Pushedskydiver/clancy.git\n');

    expect(detectRemote(exec)).toEqual({
      host: 'github',
      owner: 'Pushedskydiver',
      repo: 'clancy',
      hostname: 'github.com',
    });
    expect(exec).toHaveBeenCalledWith(['remote', 'get-url', 'origin']);
  });

  it('returns { host: "none" } when no remote is configured', () => {
    const exec = vi.fn().mockImplementation(() => {
      throw new Error('No such remote');
    });

    expect(detectRemote(exec)).toEqual({ host: 'none' });
  });

  it('returns { host: "none" } when remote URL is empty', () => {
    const exec = vi.fn().mockReturnValue('  \n');

    expect(detectRemote(exec)).toEqual({ host: 'none' });
  });

  it('uses platformOverride to force platform detection', () => {
    const exec = vi
      .fn()
      .mockReturnValue('https://git.acme.com/team/project.git\n');

    expect(detectRemote(exec, 'gitlab')).toEqual({
      host: 'gitlab',
      projectPath: 'team/project',
      hostname: 'git.acme.com',
    });
  });

  it('ignores invalid platformOverride and falls back to detection', () => {
    const exec = vi.fn().mockReturnValue('https://github.com/owner/repo.git\n');

    expect(detectRemote(exec, 'not-a-platform')).toEqual({
      host: 'github',
      owner: 'owner',
      repo: 'repo',
      hostname: 'github.com',
    });
  });
});
