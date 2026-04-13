import type { BoardConfig } from '@chief-clancy/core';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { detectBoard, loadClancyEnv } from '@chief-clancy/core';

import { loadEnv } from './loop-setup.js';

vi.mock('@chief-clancy/core', () => ({
  loadClancyEnv: vi.fn(),
  detectBoard: vi.fn(),
  createBoard: vi.fn(),
}));

vi.mock('./adapters.js', () => ({
  makeEnvFs: vi.fn(() => ({ readFile: vi.fn() })),
}));

const mockLoadClancyEnv = vi.mocked(loadClancyEnv);
const mockDetectBoard = vi.mocked(detectBoard);

// ─── loadEnv ────────────────────────────────────────────────────────────────

describe('loadEnv', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns undefined when no .clancy/.env found', () => {
    mockLoadClancyEnv.mockReturnValue(undefined);

    const result = loadEnv('/project');

    expect(result).toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('No .clancy/.env found'),
    );
  });

  it('returns undefined when detectBoard returns an error string', () => {
    mockLoadClancyEnv.mockReturnValue({ GH_TOKEN: 'x' });
    mockDetectBoard.mockReturnValue('✗ Missing GITHUB_REPO');

    const result = loadEnv('/project');

    expect(result).toBeUndefined();
    expect(console.error).toHaveBeenCalledWith('✗ Missing GITHUB_REPO');
    expect(console.error).not.toHaveBeenCalledWith(
      expect.stringContaining('✗ ✗'),
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('/clancy:implement --from'),
    );
  });

  it('returns envFs, boardConfig, and rawEnv when board is detected', () => {
    const fakeEnv = { JIRA_HOST: 'jira.example.com', JIRA_TOKEN: 'tok' };
    const fakeConfig = {
      provider: 'jira' as const,
      env: fakeEnv,
    } as unknown as BoardConfig;

    mockLoadClancyEnv.mockReturnValue(fakeEnv);
    mockDetectBoard.mockReturnValue(fakeConfig);

    const result = loadEnv('/project');

    expect(result).toBeDefined();
    expect(result!.boardConfig).toBe(fakeConfig);
    expect(result!.rawEnv).toBe(fakeEnv);
    expect(result!.envFs).toBeDefined();
  });
});
