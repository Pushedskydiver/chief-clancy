import { describe, expect, it, vi } from 'vitest';

import { runOnce } from './once.js';

type OnceOpts = Parameters<typeof runOnce>[0];

// Mock shape — fs stubs don't match full FS interface types
function createMockOpts(overrides?: Partial<OnceOpts>): OnceOpts {
  return {
    argv: [],
    projectRoot: '/tmp/test',
    isAfk: false,
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
    now: 1000,
    clock: () => 31_000, // 30s elapsed from now=1000
    ...overrides,
  } as unknown as OnceOpts;
}

function logOutput(opts: OnceOpts): string {
  const calls = (opts.console.log as ReturnType<typeof vi.fn>).mock.calls;
  return calls.map((c) => c[0]).join('\n');
}

function errorOutput(opts: OnceOpts): string {
  const calls = (opts.console.error as ReturnType<typeof vi.fn>).mock.calls;
  return calls.map((c) => c[0]).join('\n');
}

// ─── Context creation ────────────────────────────────────────────────────────

describe('runOnce — context creation', () => {
  it('passes projectRoot and argv to createContext', async () => {
    const pipeline = vi.fn().mockResolvedValue({ status: 'completed' });
    const opts = createMockOpts({
      argv: ['--dry-run'],
      projectRoot: '/my/project',
      runPipeline: pipeline,
    });

    await runOnce(opts);

    const ctx = pipeline.mock.calls[0]![0];
    expect(ctx.projectRoot).toBe('/my/project');
    expect(ctx.dryRun).toBe(true);
  });

  it('passes isAfk to context', async () => {
    const pipeline = vi.fn().mockResolvedValue({ status: 'completed' });
    const opts = createMockOpts({
      isAfk: true,
      runPipeline: pipeline,
    });

    await runOnce(opts);

    const ctx = pipeline.mock.calls[0]![0];
    expect(ctx.isAfk).toBe(true);
  });

  it('passes now to context for deterministic timing', async () => {
    const pipeline = vi.fn().mockResolvedValue({ status: 'completed' });
    const opts = createMockOpts({
      now: 5000,
      runPipeline: pipeline,
    });

    await runOnce(opts);

    const ctx = pipeline.mock.calls[0]![0];
    expect(ctx.startTime).toBe(5000);
  });
});

// ─── Dep wiring ──────────────────────────────────────────────────────────────

describe('runOnce — dep wiring', () => {
  it('passes wired PipelineDeps to runPipeline', async () => {
    const pipeline = vi.fn().mockResolvedValue({ status: 'completed' });
    const opts = createMockOpts({ runPipeline: pipeline });

    await runOnce(opts);

    const deps = pipeline.mock.calls[0]![1];
    expect(typeof deps.lockCheck).toBe('function');
    expect(typeof deps.preflight).toBe('function');
    expect(typeof deps.invoke).toBe('function');
    expect(typeof deps.deliver).toBe('function');
    expect(typeof deps.cleanup).toBe('function');
  });
});

// ─── Display ─────────────────────────────────────────────────────────────────

describe('runOnce — display', () => {
  it('prints success message on completed status', async () => {
    const opts = createMockOpts();

    await runOnce(opts);

    expect(logOutput(opts)).toContain('completed');
  });

  it('includes deterministic elapsed time from injected clock', async () => {
    const opts = createMockOpts({
      now: 1000,
      clock: () => 31_000, // 30s elapsed
    });

    await runOnce(opts);

    expect(logOutput(opts)).toContain('30s');
  });

  // ─── Display — aborted ──────────────────────────────────────────────────

  it('prints abort message with phase name', async () => {
    const opts = createMockOpts({
      runPipeline: vi
        .fn()
        .mockResolvedValue({ status: 'aborted', phase: 'preflight' }),
    });

    await runOnce(opts);

    const output = logOutput(opts);
    expect(output).toContain('aborted');
    expect(output).toContain('preflight');
  });

  it('prints unknown for aborted without phase', async () => {
    const opts = createMockOpts({
      runPipeline: vi.fn().mockResolvedValue({ status: 'aborted' }),
    });

    await runOnce(opts);

    expect(logOutput(opts)).toContain('unknown');
  });

  // ─── Display — resumed ──────────────────────────────────────────────────

  it('prints resumed message', async () => {
    const opts = createMockOpts({
      runPipeline: vi.fn().mockResolvedValue({ status: 'resumed' }),
    });

    await runOnce(opts);

    expect(logOutput(opts)).toContain('Resumed');
  });

  // ─── Display — dry-run ──────────────────────────────────────────────────

  it('prints dry-run message', async () => {
    const opts = createMockOpts({
      runPipeline: vi.fn().mockResolvedValue({ status: 'dry-run' }),
    });

    await runOnce(opts);

    expect(logOutput(opts)).toContain('Dry run');
  });

  // ─── Display — error ────────────────────────────────────────────────────

  it('prints error message to stderr', async () => {
    const opts = createMockOpts({
      runPipeline: vi
        .fn()
        .mockResolvedValue({ status: 'error', error: 'Something broke' }),
    });

    await runOnce(opts);

    const output = errorOutput(opts);
    expect(output).toContain('Clancy stopped');
    expect(output).toContain('Something broke');
  });

  it('prints fallback error when error field is missing', async () => {
    const opts = createMockOpts({
      runPipeline: vi.fn().mockResolvedValue({ status: 'error' }),
    });

    await runOnce(opts);

    expect(errorOutput(opts)).toContain('Unknown error');
  });

  it('does not log to stdout on error', async () => {
    const opts = createMockOpts({
      runPipeline: vi
        .fn()
        .mockResolvedValue({ status: 'error', error: 'fail' }),
    });

    await runOnce(opts);

    expect(opts.console.log).not.toHaveBeenCalled();
  });
});

// ─── Error propagation ───────────────────────────────────────────────────────

describe('runOnce — error propagation', () => {
  it('propagates runPipeline rejection to caller', async () => {
    const opts = createMockOpts({
      runPipeline: vi.fn().mockRejectedValue(new Error('Pipeline crash')),
    });

    await expect(runOnce(opts)).rejects.toThrow('Pipeline crash');
  });
});
