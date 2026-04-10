import type { LockCheckDeps } from './lock-check.js';
import type { LockData, LockFs } from '@chief-clancy/dev';

import { describe, expect, it, vi } from 'vitest';

import { createContext } from '../../context.js';
import { lockCheck } from './lock-check.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeLockData(overrides: Partial<LockData> = {}): LockData {
  return {
    pid: 99999,
    ticketKey: 'PROJ-42',
    ticketTitle: 'Add login page',
    ticketBranch: 'feat/proj-42',
    targetBranch: 'main',
    parentKey: '',
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeLockFs(overrides: Partial<LockFs> = {}): LockFs {
  return {
    readFile: vi.fn(() => {
      throw new Error('ENOENT');
    }),
    writeFile: vi.fn(),
    deleteFile: vi.fn(),
    mkdir: vi.fn(),
    ...overrides,
  };
}

function makeDeps(overrides: Partial<LockCheckDeps> = {}): LockCheckDeps {
  return {
    lockFs: makeLockFs(),
    exec: vi.fn(() => ''),
    progressFs: {
      readFile: vi.fn(() => {
        throw new Error('ENOENT');
      }),
      appendFile: vi.fn(),
      mkdir: vi.fn(),
    },
    detectResume: vi.fn(() => undefined),
    executeResume: vi.fn(async () => ({ ok: false })),
    ...overrides,
  };
}

function makeCtx(overrides: { readonly isAfk?: boolean } = {}) {
  return createContext({
    projectRoot: '/project',
    argv: [],
    ...overrides,
  });
}

// ─── lockCheck ───────────────────────────────────────────────────────────────

describe('lockCheck', () => {
  it('returns continue when no lock exists', async () => {
    const result = await lockCheck(makeCtx(), makeDeps());

    expect(result.action).toBe('continue');
  });

  it('returns abort when lock is held by active session', async () => {
    const lock = makeLockData({ pid: process.pid });
    const lockFs = makeLockFs({
      readFile: vi.fn(() => JSON.stringify(lock)),
    });

    const result = await lockCheck(makeCtx(), makeDeps({ lockFs }));

    expect(result.action).toBe('abort');
    expect(result.reason).toContain('Another');
  });

  it('cleans up stale lock and continues when no resume is possible', async () => {
    const lock = makeLockData({ pid: 99999 });
    const lockFs = makeLockFs({
      readFile: vi.fn(() => JSON.stringify(lock)),
    });

    const result = await lockCheck(makeCtx(), makeDeps({ lockFs }));

    expect(result.action).toBe('continue');
    expect(lockFs.deleteFile).toHaveBeenCalled();
  });

  it('skips already-delivered tickets on stale lock', async () => {
    const lock = makeLockData({ pid: 99999 });
    const lockFs = makeLockFs({
      readFile: vi.fn(() => JSON.stringify(lock)),
    });
    const detectResume = vi.fn(() => ({
      branch: 'feat/proj-42',
      hasUncommitted: false,
      hasUnpushed: false,
      alreadyDelivered: true,
    }));

    const result = await lockCheck(
      makeCtx(),
      makeDeps({ lockFs, detectResume }),
    );

    expect(result.action).toBe('continue');
    expect(result.reason).toContain('already delivered');
  });

  it('attempts resume in AFK mode on stale lock with work', async () => {
    const lock = makeLockData({ pid: 99999 });
    const lockFs = makeLockFs({
      readFile: vi.fn(() => JSON.stringify(lock)),
    });
    const detectResume = vi.fn(() => ({
      branch: 'feat/proj-42',
      hasUncommitted: true,
      hasUnpushed: false,
      alreadyDelivered: false,
    }));
    const executeResume = vi.fn(async () => ({ ok: true }));

    const result = await lockCheck(
      makeCtx({ isAfk: true }),
      makeDeps({ lockFs, detectResume, executeResume }),
    );

    expect(result.action).toBe('resumed');
    expect(executeResume).toHaveBeenCalled();
  });

  it('continues after failed resume in AFK mode', async () => {
    const lock = makeLockData({ pid: 99999 });
    const lockFs = makeLockFs({
      readFile: vi.fn(() => JSON.stringify(lock)),
    });
    const detectResume = vi.fn(() => ({
      branch: 'feat/proj-42',
      hasUncommitted: true,
      hasUnpushed: false,
      alreadyDelivered: false,
    }));
    const executeResume = vi.fn(async () => ({ ok: false }));

    const result = await lockCheck(
      makeCtx({ isAfk: true }),
      makeDeps({ lockFs, detectResume, executeResume }),
    );

    expect(result.action).toBe('continue');
  });

  it('reports in-progress work in interactive mode without resuming', async () => {
    const lock = makeLockData({ pid: 99999 });
    const lockFs = makeLockFs({
      readFile: vi.fn(() => JSON.stringify(lock)),
    });
    const detectResume = vi.fn(() => ({
      branch: 'feat/proj-42',
      hasUncommitted: true,
      hasUnpushed: true,
      alreadyDelivered: false,
    }));
    const executeResume = vi.fn(async () => ({ ok: false }));

    const result = await lockCheck(
      makeCtx({ isAfk: false }),
      makeDeps({ lockFs, detectResume, executeResume }),
    );

    expect(result.action).toBe('continue');
    expect(result.reason).toContain('in-progress work');
    expect(executeResume).not.toHaveBeenCalled();
  });

  it('continues gracefully when executeResume rejects in AFK mode', async () => {
    const lock = makeLockData({ pid: 99999 });
    const lockFs = makeLockFs({
      readFile: vi.fn(() => JSON.stringify(lock)),
    });
    const detectResume = vi.fn(() => ({
      branch: 'feat/proj-42',
      hasUncommitted: true,
      hasUnpushed: false,
      alreadyDelivered: false,
    }));
    const executeResume = vi.fn(async () => {
      throw new Error('resume crashed');
    });

    const result = await lockCheck(
      makeCtx({ isAfk: true }),
      makeDeps({ lockFs, detectResume, executeResume }),
    );

    expect(result.action).toBe('continue');
  });

  it('continues gracefully when resume detection throws', async () => {
    const lock = makeLockData({ pid: 99999 });
    const lockFs = makeLockFs({
      readFile: vi.fn(() => JSON.stringify(lock)),
    });
    const detectResume = vi.fn(() => {
      throw new Error('git failure');
    });

    const result = await lockCheck(
      makeCtx(),
      makeDeps({ lockFs, detectResume }),
    );

    expect(result.action).toBe('continue');
  });
});
