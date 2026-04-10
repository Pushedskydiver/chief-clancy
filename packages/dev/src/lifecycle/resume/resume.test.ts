import type { LockData } from '~/c/dev/lifecycle/lock/index.js';
import type { ProgressEntry } from '~/c/dev/lifecycle/progress/index.js';

import { describe, expect, it, vi } from 'vitest';

import { detectResume, executeResume } from './resume.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type ExecGit = (args: readonly string[]) => string;

function makeLock(overrides: Partial<LockData> = {}): LockData {
  return {
    pid: process.pid,
    ticketKey: 'PROJ-42',
    ticketTitle: 'Add login page',
    ticketBranch: 'feature/proj-42',
    targetBranch: 'main',
    parentKey: '',
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Options for the mock exec builder. */
type MockExecOpts = {
  readonly currentBranch?: string;
  readonly branchExists?: boolean;
  readonly uncommitted?: boolean;
  readonly logOutput?: string;
  readonly logThrows?: boolean;
  readonly fallbackLogOutput?: string;
  readonly checkoutThrows?: boolean;
  readonly commitThrows?: boolean;
  readonly pushThrows?: boolean;
};

/** Handle rev-parse, checkout, diff commands. */
function handleCoreGitCmd(
  args: readonly string[],
  opts: Required<MockExecOpts>,
): string | undefined {
  const cmd = args[0];

  if (cmd === 'rev-parse' && args[1] === '--abbrev-ref') {
    return `${opts.currentBranch}\n`;
  }
  if (cmd === 'show-ref') {
    if (!opts.branchExists) throw new Error('branch not found');
    return '';
  }
  if (cmd === 'checkout') {
    if (opts.checkoutThrows) throw new Error('checkout failed');
    return '';
  }
  if (cmd === 'diff') {
    if (opts.uncommitted) throw new Error('diff --quiet: changes detected');
    return '';
  }

  return undefined;
}

/** Handle git add, commit, push commands. */
function handleWriteCmd(cmd: string, opts: Required<MockExecOpts>): string {
  if (cmd === 'add') return '';
  if (cmd === 'commit') {
    if (opts.commitThrows) throw new Error('commit failed');
    return '';
  }
  if (cmd === 'push') {
    if (opts.pushThrows) throw new Error('push failed');
    return '';
  }
  return '';
}

/** Build a mock exec that handles specific git commands. */
function makeExec(overrides: MockExecOpts = {}): ExecGit {
  const opts: Required<MockExecOpts> = {
    currentBranch: 'main',
    branchExists: true,
    uncommitted: false,
    logOutput: '',
    logThrows: false,
    fallbackLogOutput: '',
    checkoutThrows: false,
    commitThrows: false,
    pushThrows: false,
    ...overrides,
  };

  const logCalls = vi.fn();

  return (args: readonly string[]): string => {
    const core = handleCoreGitCmd(args, opts);
    if (core !== undefined) return core;

    const cmd = args[0];

    if (cmd === 'log') {
      logCalls();
      const isFirst = logCalls.mock.calls.length === 1;
      if (isFirst && opts.logThrows) throw new Error('unknown revision');
      return isFirst ? opts.logOutput : opts.fallbackLogOutput;
    }

    return handleWriteCmd(cmd ?? '', opts);
  };
}

function makeProgressFs(entries: readonly ProgressEntry[] = []) {
  return {
    readFile: vi.fn((): string => {
      if (entries.length === 0) throw new Error('ENOENT');
      return entries
        .map(
          (e) =>
            `${e.timestamp} | ${e.key} | ${e.summary} | ${e.status}${e.prNumber ? ` | pr:${e.prNumber}` : ''}${e.parent ? ` | parent:${e.parent}` : ''}`,
        )
        .join('\n');
    }),
    appendFile: vi.fn(),
    mkdir: vi.fn(),
  };
}

// ─── detectResume ────────────────────────────────────────────────────────────

describe('detectResume', () => {
  it('returns undefined when branch does not exist', () => {
    const result = detectResume({
      exec: makeExec({ branchExists: false }),
      progressFs: makeProgressFs(),
      projectRoot: '/tmp',
      lock: makeLock(),
    });

    expect(result).toBeUndefined();
  });

  it('returns resume info with hasUncommitted when uncommitted changes exist', () => {
    const result = detectResume({
      exec: makeExec({ uncommitted: true }),
      progressFs: makeProgressFs(),
      projectRoot: '/tmp',
      lock: makeLock(),
    });

    expect(result).toEqual({
      branch: 'feature/proj-42',
      hasUncommitted: true,
      hasUnpushed: false,
      alreadyDelivered: false,
    });
  });

  it('returns resume info with hasUnpushed when unpushed commits exist', () => {
    const result = detectResume({
      exec: makeExec({ logOutput: 'abc1234 some commit' }),
      progressFs: makeProgressFs(),
      projectRoot: '/tmp',
      lock: makeLock(),
    });

    expect(result).toEqual({
      branch: 'feature/proj-42',
      hasUncommitted: false,
      hasUnpushed: true,
      alreadyDelivered: false,
    });
  });

  it('returns resume info with both flags when uncommitted and unpushed exist', () => {
    const result = detectResume({
      exec: makeExec({ uncommitted: true, logOutput: 'abc1234 commit' }),
      progressFs: makeProgressFs(),
      projectRoot: '/tmp',
      lock: makeLock(),
    });

    expect(result).toEqual({
      branch: 'feature/proj-42',
      hasUncommitted: true,
      hasUnpushed: true,
      alreadyDelivered: false,
    });
  });

  it('returns undefined when branch exists but has no changes', () => {
    const result = detectResume({
      exec: makeExec(),
      progressFs: makeProgressFs(),
      projectRoot: '/tmp',
      lock: makeLock(),
    });

    expect(result).toBeUndefined();
  });

  it('returns undefined when checkout fails', () => {
    const result = detectResume({
      exec: makeExec({ checkoutThrows: true }),
      progressFs: makeProgressFs(),
      projectRoot: '/tmp',
      lock: makeLock(),
    });

    expect(result).toBeUndefined();
  });

  it('falls back to target branch comparison when remote branch missing', () => {
    const result = detectResume({
      exec: makeExec({
        logThrows: true,
        fallbackLogOutput: 'def5678 fallback commit',
      }),
      progressFs: makeProgressFs(),
      projectRoot: '/tmp',
      lock: makeLock(),
    });

    expect(result).toEqual({
      branch: 'feature/proj-42',
      hasUncommitted: false,
      hasUnpushed: true,
      alreadyDelivered: false,
    });
  });

  it('returns alreadyDelivered when progress shows PR_CREATED', () => {
    const progressFs = makeProgressFs([
      {
        timestamp: '2026-03-22 10:00',
        key: 'PROJ-42',
        summary: 'Add login page',
        status: 'PR_CREATED',
        prNumber: 5,
      },
    ]);

    const result = detectResume({
      exec: makeExec(),
      progressFs,
      projectRoot: '/tmp',
      lock: makeLock(),
    });

    expect(result).toEqual({
      branch: 'feature/proj-42',
      hasUncommitted: false,
      hasUnpushed: false,
      alreadyDelivered: true,
    });
  });

  it('returns alreadyDelivered for PUSHED status', () => {
    const progressFs = makeProgressFs([
      {
        timestamp: '2026-03-22 10:00',
        key: 'PROJ-42',
        summary: 'Add login page',
        status: 'PUSHED',
      },
    ]);

    const result = detectResume({
      exec: makeExec(),
      progressFs,
      projectRoot: '/tmp',
      lock: makeLock(),
    });

    expect(result).toEqual({
      branch: 'feature/proj-42',
      hasUncommitted: false,
      hasUnpushed: false,
      alreadyDelivered: true,
    });
  });

  it('returns alreadyDelivered for RESUMED status', () => {
    const progressFs = makeProgressFs([
      {
        timestamp: '2026-03-22 10:00',
        key: 'PROJ-42',
        summary: 'Add login page',
        status: 'RESUMED',
      },
    ]);

    const result = detectResume({
      exec: makeExec(),
      progressFs,
      projectRoot: '/tmp',
      lock: makeLock(),
    });

    expect(result).toEqual({
      branch: 'feature/proj-42',
      hasUncommitted: false,
      hasUnpushed: false,
      alreadyDelivered: true,
    });
  });

  it('returns undefined when no changes and non-delivery progress status', () => {
    const progressFs = makeProgressFs([
      {
        timestamp: '2026-03-22 10:00',
        key: 'PROJ-42',
        summary: 'Add login page',
        status: 'PUSH_FAILED',
      },
    ]);

    const result = detectResume({
      exec: makeExec(),
      progressFs,
      projectRoot: '/tmp',
      lock: makeLock(),
    });

    expect(result).toBeUndefined();
  });
});

// ─── executeResume ───────────────────────────────────────────────────────────

describe('executeResume', () => {
  const baseResumeInfo = {
    branch: 'feature/proj-42',
    hasUncommitted: false,
    hasUnpushed: true,
    alreadyDelivered: false,
  };

  it('pushes and returns ok when hasUnpushed only', async () => {
    const progressFs = makeProgressFs();

    const result = await executeResume({
      exec: makeExec(),
      progressFs,
      projectRoot: '/tmp',
      lock: makeLock(),
      resumeInfo: baseResumeInfo,
    });

    expect(result.ok).toBe(true);
    expect(progressFs.appendFile).toHaveBeenCalled();
  });

  it('commits then pushes when hasUncommitted', async () => {
    const calls: string[] = [];
    const exec = (args: readonly string[]): string => {
      calls.push(args[0]!);
      return makeExec()(args);
    };

    const result = await executeResume({
      exec,
      progressFs: makeProgressFs(),
      projectRoot: '/tmp',
      lock: makeLock(),
      resumeInfo: { ...baseResumeInfo, hasUncommitted: true },
    });

    expect(result.ok).toBe(true);
    const addIdx = calls.indexOf('add');
    const commitIdx = calls.indexOf('commit');
    const pushIdx = calls.indexOf('push');
    expect(addIdx).toBeLessThan(commitIdx);
    expect(commitIdx).toBeLessThan(pushIdx);
  });

  it('returns failure when push fails', async () => {
    const result = await executeResume({
      exec: makeExec({ pushThrows: true }),
      progressFs: makeProgressFs(),
      projectRoot: '/tmp',
      lock: makeLock(),
      resumeInfo: baseResumeInfo,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('push');
  });

  it('returns failure when commit fails', async () => {
    const result = await executeResume({
      exec: makeExec({ commitThrows: true }),
      progressFs: makeProgressFs(),
      projectRoot: '/tmp',
      lock: makeLock(),
      resumeInfo: { ...baseResumeInfo, hasUncommitted: true },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('commit');
  });

  it('calls createPr and includes result', async () => {
    const createPr = vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://github.com/o/r/pull/5',
      number: 5,
    });

    const result = await executeResume({
      exec: makeExec(),
      progressFs: makeProgressFs(),
      projectRoot: '/tmp',
      lock: makeLock(),
      resumeInfo: baseResumeInfo,
      createPr,
    });

    expect(result.ok).toBe(true);
    expect(result.prResult).toEqual({
      ok: true,
      url: 'https://github.com/o/r/pull/5',
      number: 5,
    });
    expect(createPr).toHaveBeenCalledWith(
      expect.objectContaining({ ticketKey: 'PROJ-42' }),
      'feature/proj-42',
    );
  });

  it('succeeds without PR when createPr fails', async () => {
    const createPr = vi
      .fn()
      .mockResolvedValue({ ok: false, error: 'PR failed' });

    const result = await executeResume({
      exec: makeExec(),
      progressFs: makeProgressFs(),
      projectRoot: '/tmp',
      lock: makeLock(),
      resumeInfo: baseResumeInfo,
      createPr,
    });

    expect(result.ok).toBe(true);
    expect(result.prResult?.ok).toBe(false);
  });

  it('succeeds without PR when createPr not provided', async () => {
    const result = await executeResume({
      exec: makeExec(),
      progressFs: makeProgressFs(),
      projectRoot: '/tmp',
      lock: makeLock(),
      resumeInfo: baseResumeInfo,
    });

    expect(result.ok).toBe(true);
    expect(result.prResult).toBeUndefined();
  });

  it('appends RESUMED progress with PR number', async () => {
    const progressFs = makeProgressFs();
    const createPr = vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://github.com/o/r/pull/12',
      number: 12,
    });

    await executeResume({
      exec: makeExec(),
      progressFs,
      projectRoot: '/tmp',
      lock: makeLock({ parentKey: 'PROJ-10' }),
      resumeInfo: baseResumeInfo,
      createPr,
    });

    const appendCall = progressFs.appendFile.mock.calls[0]?.[1] as string;
    expect(appendCall).toContain('PROJ-42');
    expect(appendCall).toContain('RESUMED');
    expect(appendCall).toContain('pr:12');
    expect(appendCall).toContain('parent:PROJ-10');
  });

  it('appends RESUMED progress without PR number on failure', async () => {
    const progressFs = makeProgressFs();
    const createPr = vi.fn().mockResolvedValue({ ok: false, error: 'failed' });

    await executeResume({
      exec: makeExec(),
      progressFs,
      projectRoot: '/tmp',
      lock: makeLock(),
      resumeInfo: baseResumeInfo,
      createPr,
    });

    const appendCall = progressFs.appendFile.mock.calls[0]?.[1] as string;
    expect(appendCall).toContain('RESUMED');
    expect(appendCall).not.toContain('pr:');
  });

  it('treats empty parentKey as undefined', async () => {
    const progressFs = makeProgressFs();

    await executeResume({
      exec: makeExec(),
      progressFs,
      projectRoot: '/tmp',
      lock: makeLock({ parentKey: '' }),
      resumeInfo: baseResumeInfo,
    });

    const appendCall = progressFs.appendFile.mock.calls[0]?.[1] as string;
    expect(appendCall).not.toContain('parent:');
  });

  it('treats "none" parentKey as undefined', async () => {
    const progressFs = makeProgressFs();

    await executeResume({
      exec: makeExec(),
      progressFs,
      projectRoot: '/tmp',
      lock: makeLock({ parentKey: 'none' }),
      resumeInfo: baseResumeInfo,
    });

    const appendCall = progressFs.appendFile.mock.calls[0]?.[1] as string;
    expect(appendCall).not.toContain('parent:');
  });

  it('returns failure when initial checkout throws', async () => {
    const result = await executeResume({
      exec: makeExec({ checkoutThrows: true }),
      progressFs: makeProgressFs(),
      projectRoot: '/tmp',
      lock: makeLock(),
      resumeInfo: baseResumeInfo,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});
