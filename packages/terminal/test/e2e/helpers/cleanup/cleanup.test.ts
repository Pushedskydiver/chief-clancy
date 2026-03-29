import type { MockInstance } from 'vitest';

import { execFileSync } from 'node:child_process';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { cleanupBranch, cleanupPullRequest, cleanupTicket } from './cleanup.js';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('./github.js', () => ({
  cleanupGitHubTicket: vi.fn().mockResolvedValue(undefined),
  cleanupGitHubPullRequest: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./jira.js', () => ({
  cleanupJiraTicket: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./linear.js', () => ({
  cleanupLinearTicket: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./shortcut.js', () => ({
  cleanupShortcutTicket: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./notion.js', () => ({
  cleanupNotionTicket: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./azdo.js', () => ({
  cleanupAzdoTicket: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('cleanupTicket', () => {
  it('is a callable function accepting board and ticketId', () => {
    expect(typeof cleanupTicket).toBe('function');
    expect(cleanupTicket.length).toBe(2);
  });

  it('dispatches to the correct board cleaner', async () => {
    const { cleanupGitHubTicket } = await import('./github.js');
    const { cleanupJiraTicket } = await import('./jira.js');
    const { cleanupLinearTicket } = await import('./linear.js');
    const { cleanupShortcutTicket } = await import('./shortcut.js');
    const { cleanupNotionTicket } = await import('./notion.js');
    const { cleanupAzdoTicket } = await import('./azdo.js');

    await cleanupTicket('github', '42');
    expect(cleanupGitHubTicket).toHaveBeenCalledWith('42');

    await cleanupTicket('jira', 'PROJ-1');
    expect(cleanupJiraTicket).toHaveBeenCalledWith('PROJ-1');

    await cleanupTicket('linear', 'uuid-1');
    expect(cleanupLinearTicket).toHaveBeenCalledWith('uuid-1');

    await cleanupTicket('shortcut', '999');
    expect(cleanupShortcutTicket).toHaveBeenCalledWith('999');

    await cleanupTicket('notion', 'page-id');
    expect(cleanupNotionTicket).toHaveBeenCalledWith('page-id');

    await cleanupTicket('azdo', '123');
    expect(cleanupAzdoTicket).toHaveBeenCalledWith('123');
  });
});

describe('cleanupPullRequest', () => {
  it('is a callable function accepting prNumber', () => {
    expect(typeof cleanupPullRequest).toBe('function');
    expect(cleanupPullRequest.length).toBe(1);
  });

  it('delegates to GitHub PR cleanup', async () => {
    const { cleanupGitHubPullRequest } = await import('./github.js');

    await cleanupPullRequest('77');
    expect(cleanupGitHubPullRequest).toHaveBeenCalledWith('77');
  });
});

describe('cleanupBranch', () => {
  const mockExecFileSync = execFileSync as unknown as MockInstance;

  it('calls git push --delete with the branch name', () => {
    mockExecFileSync.mockReturnValue(Buffer.from(''));

    cleanupBranch('/repo', 'test-branch');

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      ['push', 'origin', '--delete', 'test-branch'],
      { cwd: '/repo', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  });

  it('silently succeeds when the branch does not exist', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('branch not found');
    });

    expect(() => cleanupBranch('/repo', 'missing')).not.toThrow();
  });
});
