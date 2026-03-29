import { afterEach, describe, expect, it, vi } from 'vitest';

import { cleanupOrphanTickets } from './gc.js';

vi.mock('./github.js', () => ({
  cleanupGitHubOrphans: vi.fn().mockResolvedValue(0),
}));
vi.mock('./jira.js', () => ({
  cleanupJiraOrphans: vi.fn().mockResolvedValue(0),
}));
vi.mock('./linear.js', () => ({
  cleanupLinearOrphans: vi.fn().mockResolvedValue(0),
}));
vi.mock('./shortcut.js', () => ({
  cleanupShortcutOrphans: vi.fn().mockResolvedValue(0),
}));
vi.mock('./notion.js', () => ({
  cleanupNotionOrphans: vi.fn().mockResolvedValue(0),
}));
vi.mock('./azdo.js', () => ({
  cleanupAzdoOrphans: vi.fn().mockResolvedValue(0),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('cleanupOrphanTickets', () => {
  it('is a callable function accepting a board', () => {
    expect(typeof cleanupOrphanTickets).toBe('function');
    expect(cleanupOrphanTickets.length).toBe(1);
  });

  it('dispatches to the correct board cleaner', async () => {
    const { cleanupGitHubOrphans } = await import('./github.js');
    const { cleanupJiraOrphans } = await import('./jira.js');
    const { cleanupLinearOrphans } = await import('./linear.js');
    const { cleanupShortcutOrphans } = await import('./shortcut.js');
    const { cleanupNotionOrphans } = await import('./notion.js');
    const { cleanupAzdoOrphans } = await import('./azdo.js');

    await cleanupOrphanTickets('github');
    expect(cleanupGitHubOrphans).toHaveBeenCalledOnce();

    await cleanupOrphanTickets('jira');
    expect(cleanupJiraOrphans).toHaveBeenCalledOnce();

    await cleanupOrphanTickets('linear');
    expect(cleanupLinearOrphans).toHaveBeenCalledOnce();

    await cleanupOrphanTickets('shortcut');
    expect(cleanupShortcutOrphans).toHaveBeenCalledOnce();

    await cleanupOrphanTickets('notion');
    expect(cleanupNotionOrphans).toHaveBeenCalledOnce();

    await cleanupOrphanTickets('azdo');
    expect(cleanupAzdoOrphans).toHaveBeenCalledOnce();
  });

  it('returns the count from the board cleaner', async () => {
    const { cleanupGitHubOrphans } = await import('./github.js');
    vi.mocked(cleanupGitHubOrphans).mockResolvedValue(5);

    const count = await cleanupOrphanTickets('github');
    expect(count).toBe(5);
  });
});
