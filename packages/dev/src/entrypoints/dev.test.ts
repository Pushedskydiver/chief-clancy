import type { BoardConfig } from '@chief-clancy/core';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { detectBoard, loadClancyEnv } from '@chief-clancy/core';

import { loadEnv } from './dev.js';

vi.mock('@chief-clancy/core', () => ({
  loadClancyEnv: vi.fn(),
  detectBoard: vi.fn(),
  createBoard: vi.fn(),
}));

vi.mock('./adapters.js', () => ({
  makeEnvFs: vi.fn(() => ({ readFile: vi.fn() })),
  makeExecGit: vi.fn(),
  makeLockFs: vi.fn(),
  makeProgressFs: vi.fn(),
  makeCostFs: vi.fn(),
  makeQualityFs: vi.fn(),
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
    mockLoadClancyEnv.mockReturnValue({ JIRA_HOST: 'x' });
    mockDetectBoard.mockReturnValue('✗ Missing JIRA_TOKEN');

    const result = loadEnv('/project');

    expect(result).toBeUndefined();
    expect(console.error).toHaveBeenCalledWith('✗ Missing JIRA_TOKEN');
    expect(console.error).not.toHaveBeenCalledWith(
      expect.stringContaining('✗ ✗'),
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('/clancy:implement --from'),
    );
  });

  it('returns envFs and boardConfig when board is detected', () => {
    const fakeEnv = { JIRA_HOST: 'x', JIRA_TOKEN: 'y' };
    const fakeConfig = {
      provider: 'jira' as const,
      env: fakeEnv,
    } as unknown as BoardConfig;

    mockLoadClancyEnv.mockReturnValue(fakeEnv);
    mockDetectBoard.mockReturnValue(fakeConfig);

    const result = loadEnv('/project');

    expect(result).toBeDefined();
    expect(result!.boardConfig).toBe(fakeConfig);
    expect(result!.envFs).toBeDefined();
  });
});
