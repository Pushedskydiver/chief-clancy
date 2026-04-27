import { describe, expect, it, vi } from 'vitest';

import { runImplement } from './implement.js';

type ImplementOpts = Parameters<typeof runImplement>[0];

// Mock shape — fs stubs don't match full FS interface types
function createMockOpts(overrides?: Partial<ImplementOpts>): ImplementOpts {
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
  } as unknown as ImplementOpts;
}

function logOutput(opts: ImplementOpts): string {
  const calls = (opts.console.log as ReturnType<typeof vi.fn>).mock.calls;
  return calls.map((c) => c[0]).join('\n');
}

function errorOutput(opts: ImplementOpts): string {
  const calls = (opts.console.error as ReturnType<typeof vi.fn>).mock.calls;
  return calls.map((c) => c[0]).join('\n');
}

// ─── Context creation ────────────────────────────────────────────────────────

describe('runImplement — context creation', () => {
  it('passes projectRoot and argv to createContext', async () => {
    const pipeline = vi.fn().mockResolvedValue({ status: 'completed' });
    const opts = createMockOpts({
      argv: ['--dry-run'],
      projectRoot: '/my/project',
      runPipeline: pipeline,
    });

    await runImplement(opts);

    const ctx = pipeline.mock.calls[0][0];
    expect(ctx.projectRoot).toBe('/my/project');
    expect(ctx.dryRun).toBe(true);
  });

  it('passes isAfk to context', async () => {
    const pipeline = vi.fn().mockResolvedValue({ status: 'completed' });
    const opts = createMockOpts({
      isAfk: true,
      runPipeline: pipeline,
    });

    await runImplement(opts);

    const ctx = pipeline.mock.calls[0][0];
    expect(ctx.isAfk).toBe(true);
  });

  it('passes now to context for deterministic timing', async () => {
    const pipeline = vi.fn().mockResolvedValue({ status: 'completed' });
    const opts = createMockOpts({
      now: 5000,
      runPipeline: pipeline,
    });

    await runImplement(opts);

    const ctx = pipeline.mock.calls[0][0];
    expect(ctx.startTime).toBe(5000);
  });
});

// ─── Dep wiring ──────────────────────────────────────────────────────────────

describe('runImplement — dep wiring', () => {
  it('passes wired PipelineDeps to runPipeline', async () => {
    const pipeline = vi.fn().mockResolvedValue({ status: 'completed' });
    const opts = createMockOpts({ runPipeline: pipeline });

    await runImplement(opts);

    const deps = pipeline.mock.calls[0][1];
    expect(typeof deps.lockCheck).toBe('function');
    expect(typeof deps.preflight).toBe('function');
    expect(typeof deps.invoke).toBe('function');
    expect(typeof deps.deliver).toBe('function');
    expect(typeof deps.cleanup).toBe('function');
  });
});

// ─── Display ─────────────────────────────────────────────────────────────────

describe('runImplement — display', () => {
  it('prints success message on completed status', async () => {
    const opts = createMockOpts();

    await runImplement(opts);

    expect(logOutput(opts)).toContain('completed');
  });

  it('includes deterministic elapsed time from injected clock', async () => {
    const opts = createMockOpts({
      now: 1000,
      clock: () => 31_000, // 30s elapsed
    });

    await runImplement(opts);

    expect(logOutput(opts)).toContain('30s');
  });

  // ─── Display — aborted ──────────────────────────────────────────────────

  it('prints abort message with phase name', async () => {
    const opts = createMockOpts({
      runPipeline: vi
        .fn()
        .mockResolvedValue({ status: 'aborted', phase: 'preflight' }),
    });

    await runImplement(opts);

    const output = logOutput(opts);
    expect(output).toContain('aborted');
    expect(output).toContain('preflight');
  });

  it('prints unknown for aborted without phase', async () => {
    const opts = createMockOpts({
      runPipeline: vi.fn().mockResolvedValue({ status: 'aborted' }),
    });

    await runImplement(opts);

    expect(logOutput(opts)).toContain('unknown');
  });

  it('prints abort reason when error is present', async () => {
    const opts = createMockOpts({
      runPipeline: vi.fn().mockResolvedValue({
        status: 'aborted',
        phase: 'invoke',
        error: 'auth: token expired',
      }),
    });

    await runImplement(opts);

    expect(logOutput(opts)).toContain('auth: token expired');
  });

  // ─── Display — resumed ──────────────────────────────────────────────────

  it('prints resumed message', async () => {
    const opts = createMockOpts({
      runPipeline: vi.fn().mockResolvedValue({ status: 'resumed' }),
    });

    await runImplement(opts);

    expect(logOutput(opts)).toContain('Resumed');
  });

  // ─── Display — dry-run ──────────────────────────────────────────────────

  it('prints dry-run message', async () => {
    const opts = createMockOpts({
      runPipeline: vi.fn().mockResolvedValue({ status: 'dry-run' }),
    });

    await runImplement(opts);

    expect(logOutput(opts)).toContain('Dry run');
  });

  // ─── Display — error ────────────────────────────────────────────────────

  it('prints error message to stderr', async () => {
    const opts = createMockOpts({
      runPipeline: vi
        .fn()
        .mockResolvedValue({ status: 'error', error: 'Something broke' }),
    });

    await runImplement(opts);

    const output = errorOutput(opts);
    expect(output).toContain('Clancy stopped');
    expect(output).toContain('Something broke');
  });

  it('prints fallback error when error field is missing', async () => {
    const opts = createMockOpts({
      runPipeline: vi.fn().mockResolvedValue({ status: 'error' }),
    });

    await runImplement(opts);

    expect(errorOutput(opts)).toContain('Unknown error');
  });

  it('does not log to stdout on error', async () => {
    const opts = createMockOpts({
      runPipeline: vi
        .fn()
        .mockResolvedValue({ status: 'error', error: 'fail' }),
    });

    await runImplement(opts);

    expect(opts.console.log).not.toHaveBeenCalled();
  });
});

// ─── Error propagation ───────────────────────────────────────────────────────

describe('runImplement — error propagation', () => {
  it('propagates runPipeline rejection to caller', async () => {
    const opts = createMockOpts({
      runPipeline: vi.fn().mockRejectedValue(new Error('Pipeline crash')),
    });

    await expect(runImplement(opts)).rejects.toThrow('Pipeline crash');
  });
});

// ─── End-to-end stderr-tee chain ─────────────────────────────────────────────
//
// PR-1 LOW-3 deferral resolved here. Exercises the full chain: runImplement
// → buildPipelineDeps → makeInvokePhase → invokeClaudeSession (real, not
// mocked at this file level) → injected streamingSpawn. A custom runPipeline
// populates the context fields the invoke phase reads, then calls deps.invoke
// directly so the captured stderr surfaces through error.message into the
// aborted display.

describe('runImplement — stderr tee through invoke phase', () => {
  it('surfaces captured stderr from streamingSpawn into the aborted display', async () => {
    const fakeStreamingSpawn = vi.fn().mockResolvedValue({
      stdout: '',
      stderr: 'auth: token expired\nclaude: refusing to start',
      status: 1,
      signal: null,
    });

    const opts = createMockOpts({
      streamingSpawn: fakeStreamingSpawn,
      runPipeline: async (ctx, deps) => {
        ctx.setPreflight(
          {
            provider: 'github',
            env: {
              CLANCY_TDD: 'false',
              CLANCY_MODEL: 'opus',
            },
          } as never,
          {} as never,
        );
        ctx.setTicket({
          key: 'GH-1',
          title: 'End-to-end stderr capture',
          description: 'Trigger an invoke failure with non-empty stderr.',
          parentInfo: 'none',
          blockers: 'None',
        });
        ctx.setRework({ isRework: false });
        const result = await deps.invoke(ctx);
        if (result.ok) return { status: 'completed' };
        return {
          status: 'aborted',
          phase: 'invoke',
          error: result.error.message,
        };
      },
    });

    await runImplement(opts);

    expect(fakeStreamingSpawn).toHaveBeenCalledOnce();
    const output = logOutput(opts);
    expect(output).toContain('aborted at invoke');
    expect(output).toContain('auth: token expired');
  });
});
