import { describe, expect, it, vi } from 'vitest';

import { runImplementBatch } from './batch.js';

type BatchOpts = Parameters<typeof runImplementBatch>[0];

// ─── Helpers ────────────────────────────────────────────────────────────────

function createBatchOpts(overrides?: Partial<BatchOpts>): BatchOpts {
  return {
    directory: '/plans',
    argv: ['--from', '/plans', '--afk'],
    projectRoot: '/tmp/test',
    exec: vi.fn(),
    lockFs: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      deleteFile: vi.fn(),
      mkdir: vi.fn(),
    },
    progressFs: { readFile: vi.fn(), appendFile: vi.fn(), mkdir: vi.fn() },
    costFs: { readFile: vi.fn(), appendFile: vi.fn(), mkdir: vi.fn() },
    envFs: { exists: vi.fn(), readFile: vi.fn() },
    qualityFs: { readFile: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn() },
    spawn: vi.fn(),
    fetch: vi.fn(),
    runPipeline: vi.fn().mockResolvedValue({ status: 'completed' }),
    console: { log: vi.fn(), error: vi.fn() },
    planFs: {
      readdir: vi.fn().mockReturnValue([]),
      exists: vi.fn().mockReturnValue(false),
    },
    now: 1000,
    clock: () => 31_000,
    ...overrides,
  } as unknown as BatchOpts;
}

function logOutput(opts: BatchOpts): string {
  const calls = (opts.console.log as ReturnType<typeof vi.fn>).mock.calls;
  return calls.map((c) => c[0]).join('\n');
}

function pipelineCallCount(opts: BatchOpts): number {
  return (opts.runPipeline as ReturnType<typeof vi.fn>).mock.calls.length;
}

// ─── Empty directory ────────────────────────────────────────────────────────

describe('runImplementBatch — empty directory', () => {
  it('reports no plans found when directory is empty', async () => {
    const opts = createBatchOpts({
      planFs: {
        readdir: vi.fn().mockReturnValue([]),
        exists: vi.fn().mockReturnValue(false),
      },
    });

    await runImplementBatch(opts);

    expect(logOutput(opts)).toContain('No plan files found');
  });

  it('does not run pipeline for empty directory', async () => {
    const opts = createBatchOpts();

    await runImplementBatch(opts);

    expect(pipelineCallCount(opts)).toBe(0);
  });
});

// ─── Approved plans ─────────────────────────────────────────────────────────

describe('runImplementBatch — approved plans', () => {
  it('runs pipeline for each approved plan', async () => {
    const opts = createBatchOpts({
      planFs: {
        readdir: vi.fn().mockReturnValue(['plan-1.md', 'plan-2.md']),
        exists: vi.fn().mockReturnValue(true),
      },
    });

    await runImplementBatch(opts);

    expect(pipelineCallCount(opts)).toBe(2);
  });

  it('passes correct --from path for each plan', async () => {
    const pipeline = vi.fn().mockResolvedValue({ status: 'completed' });
    const opts = createBatchOpts({
      directory: '/my/plans',
      runPipeline: pipeline,
      planFs: {
        readdir: vi.fn().mockReturnValue(['a-1.md', 'a-2.md']),
        exists: vi.fn().mockReturnValue(true),
      },
    });

    await runImplementBatch(opts);

    const firstCtx = pipeline.mock.calls[0][0];
    expect(firstCtx.fromPath).toBe('/my/plans/a-1.md');

    const secondCtx = pipeline.mock.calls[1][0];
    expect(secondCtx.fromPath).toBe('/my/plans/a-2.md');
  });
});

// ─── Unapproved plans ──────────────────────────────────────────────────────

describe('runImplementBatch — unapproved plans', () => {
  it('skips unapproved plans', async () => {
    const opts = createBatchOpts({
      planFs: {
        readdir: vi.fn().mockReturnValue(['plan-1.md', 'plan-2.md']),
        exists: vi.fn().mockReturnValue(false),
      },
    });

    await runImplementBatch(opts);

    expect(pipelineCallCount(opts)).toBe(0);
  });

  it('logs warning for each skipped plan', async () => {
    const opts = createBatchOpts({
      planFs: {
        readdir: vi.fn().mockReturnValue(['plan-1.md']),
        exists: vi.fn().mockReturnValue(false),
      },
    });

    await runImplementBatch(opts);

    expect(logOutput(opts)).toContain('plan-1');
    expect(logOutput(opts)).toContain('not approved');
  });
});

// ─── Stop on first failure ──────────────────────────────────────────────────

describe('runImplementBatch — failure handling', () => {
  it('stops after first pipeline error', async () => {
    const pipeline = vi
      .fn()
      .mockResolvedValueOnce({ status: 'error', error: 'Something broke' })
      .mockResolvedValueOnce({ status: 'completed' });

    const opts = createBatchOpts({
      runPipeline: pipeline,
      planFs: {
        readdir: vi.fn().mockReturnValue(['plan-1.md', 'plan-2.md']),
        exists: vi.fn().mockReturnValue(true),
      },
    });

    await runImplementBatch(opts);

    expect(pipelineCallCount(opts)).toBe(1);
  });

  it('stops after first pipeline abort', async () => {
    const pipeline = vi
      .fn()
      .mockResolvedValueOnce({ status: 'aborted', phase: 'preflight' })
      .mockResolvedValueOnce({ status: 'completed' });

    const opts = createBatchOpts({
      runPipeline: pipeline,
      planFs: {
        readdir: vi.fn().mockReturnValue(['plan-1.md', 'plan-2.md']),
        exists: vi.fn().mockReturnValue(true),
      },
    });

    await runImplementBatch(opts);

    expect(pipelineCallCount(opts)).toBe(1);
  });

  it('continues through all plans in dry-run mode', async () => {
    const pipeline = vi.fn().mockResolvedValue({ status: 'dry-run' });

    const opts = createBatchOpts({
      runPipeline: pipeline,
      planFs: {
        readdir: vi
          .fn()
          .mockReturnValue(['plan-1.md', 'plan-2.md', 'plan-3.md']),
        exists: vi.fn().mockReturnValue(true),
      },
    });

    await runImplementBatch(opts);

    expect(pipelineCallCount(opts)).toBe(3);
  });

  it('uses "previewed" label in dry-run summary', async () => {
    const pipeline = vi.fn().mockResolvedValue({ status: 'dry-run' });

    const opts = createBatchOpts({
      runPipeline: pipeline,
      planFs: {
        readdir: vi.fn().mockReturnValue(['plan-1.md', 'plan-2.md']),
        exists: vi.fn().mockReturnValue(true),
      },
    });

    await runImplementBatch(opts);

    const output = logOutput(opts);
    expect(output).toContain('2 previewed');
    expect(output).not.toContain('implemented');
  });
});

// ─── Summary ────────────────────────────────────────────────────────────────

describe('runImplementBatch — summary', () => {
  it('reports implemented count on success', async () => {
    const opts = createBatchOpts({
      planFs: {
        readdir: vi.fn().mockReturnValue(['plan-1.md', 'plan-2.md']),
        exists: vi.fn().mockReturnValue(true),
      },
    });

    await runImplementBatch(opts);

    const output = logOutput(opts);
    expect(output).toContain('2 implemented');
  });

  it('reports skipped count', async () => {
    const opts = createBatchOpts({
      planFs: {
        readdir: vi
          .fn()
          .mockReturnValue(['plan-1.md', 'plan-2.md', 'plan-3.md']),
        exists: vi
          .fn()
          .mockImplementation((p: string) => p.endsWith('plan-1.approved')),
      },
    });

    await runImplementBatch(opts);

    const output = logOutput(opts);
    expect(output).toContain('2 skipped');
  });

  it('reports remaining count after failure', async () => {
    const pipeline = vi
      .fn()
      .mockResolvedValueOnce({ status: 'completed' })
      .mockResolvedValueOnce({ status: 'error', error: 'fail' });

    const opts = createBatchOpts({
      runPipeline: pipeline,
      planFs: {
        readdir: vi
          .fn()
          .mockReturnValue(['plan-1.md', 'plan-2.md', 'plan-3.md']),
        exists: vi.fn().mockReturnValue(true),
      },
    });

    await runImplementBatch(opts);

    const output = logOutput(opts);
    expect(output).toContain('1 remaining');
  });
});
