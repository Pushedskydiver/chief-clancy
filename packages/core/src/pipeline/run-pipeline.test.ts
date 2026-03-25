import type { PipelineDeps } from './run-pipeline.js';

import { describe, expect, it, vi } from 'vitest';

import { RunContext } from './context.js';
import { runPipeline } from './run-pipeline.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCtx(argv: readonly string[] = []): RunContext {
  return new RunContext({ projectRoot: '/repo', argv });
}

function makeDeps(overrides: Partial<PipelineDeps> = {}): PipelineDeps {
  return {
    lockCheck: vi.fn().mockResolvedValue({ action: 'continue' }),
    preflight: vi.fn().mockResolvedValue({ ok: true }),
    epicCompletion: vi.fn().mockResolvedValue({ results: [] }),
    prRetry: vi.fn().mockResolvedValue({ results: [] }),
    reworkDetection: vi.fn().mockResolvedValue({ detected: false }),
    ticketFetch: vi.fn().mockResolvedValue({ ok: true }),
    feasibility: vi.fn().mockResolvedValue({ ok: true }),
    branchSetup: vi.fn().mockResolvedValue({ ok: true }),
    transition: vi.fn().mockResolvedValue({ ok: true }),
    invoke: vi.fn().mockResolvedValue(true),
    deliver: vi.fn().mockResolvedValue({ ok: true }),
    cost: vi.fn().mockReturnValue({ ok: true }),
    cleanup: vi.fn().mockResolvedValue({
      ok: true,
      ticketKey: 'PROJ-1',
      ticketTitle: 'Test',
      elapsedMs: 1000,
    }),
    checkout: vi.fn(),
    deleteLock: vi.fn(),
    deleteVerifyAttempt: vi.fn(),
    ...overrides,
  };
}

// ─── Happy path ──────────────────────────────────────────────────────────────

describe('runPipeline — happy path', () => {
  it('runs all phases in order and returns completed', async () => {
    const ctx = makeCtx();
    const deps = makeDeps();
    const result = await runPipeline(ctx, deps);

    expect(result.status).toBe('completed');
  });

  it('calls all 13 phases + invoke', async () => {
    const ctx = makeCtx();
    const deps = makeDeps();
    await runPipeline(ctx, deps);

    expect(deps.lockCheck).toHaveBeenCalledOnce();
    expect(deps.preflight).toHaveBeenCalledOnce();
    expect(deps.epicCompletion).toHaveBeenCalledOnce();
    expect(deps.prRetry).toHaveBeenCalledOnce();
    expect(deps.reworkDetection).toHaveBeenCalledOnce();
    expect(deps.ticketFetch).toHaveBeenCalledOnce();
    expect(deps.feasibility).toHaveBeenCalledOnce();
    expect(deps.branchSetup).toHaveBeenCalledOnce();
    expect(deps.transition).toHaveBeenCalledOnce();
    expect(deps.invoke).toHaveBeenCalledOnce();
    expect(deps.deliver).toHaveBeenCalledOnce();
    expect(deps.cost).toHaveBeenCalledOnce();
    expect(deps.cleanup).toHaveBeenCalledOnce();
  });

  it('passes ctx to every phase', async () => {
    const ctx = makeCtx();
    const deps = makeDeps();
    await runPipeline(ctx, deps);

    expect(deps.lockCheck).toHaveBeenCalledWith(ctx);
    expect(deps.preflight).toHaveBeenCalledWith(ctx);
    expect(deps.invoke).toHaveBeenCalledWith(ctx);
  });
});

// ─── Early exit tests ────────────────────────────────────────────────────────

describe('runPipeline — early exits', () => {
  it('stops after lock-check abort', async () => {
    const deps = makeDeps({
      lockCheck: vi.fn().mockResolvedValue({ action: 'abort' }),
    });
    const result = await runPipeline(makeCtx(), deps);

    expect(result.status).toBe('aborted');
    expect(result.phase).toBe('lock-check');
    expect(deps.preflight).not.toHaveBeenCalled();
  });

  it('stops after lock-check resumed', async () => {
    const deps = makeDeps({
      lockCheck: vi.fn().mockResolvedValue({ action: 'resumed' }),
    });
    const result = await runPipeline(makeCtx(), deps);

    expect(result.status).toBe('resumed');
    expect(deps.preflight).not.toHaveBeenCalled();
  });

  it('stops after preflight failure', async () => {
    const deps = makeDeps({
      preflight: vi.fn().mockResolvedValue({ ok: false }),
    });
    const result = await runPipeline(makeCtx(), deps);

    expect(result.status).toBe('aborted');
    expect(result.phase).toBe('preflight');
    expect(deps.epicCompletion).not.toHaveBeenCalled();
  });

  it('stops after ticket-fetch failure', async () => {
    const deps = makeDeps({
      ticketFetch: vi.fn().mockResolvedValue({ ok: false }),
    });
    const result = await runPipeline(makeCtx(), deps);

    expect(result.status).toBe('aborted');
    expect(result.phase).toBe('ticket-fetch');
    expect(deps.feasibility).not.toHaveBeenCalled();
  });

  it('stops after dry-run gate', async () => {
    const ctx = makeCtx(['--dry-run']);
    const deps = makeDeps();
    const result = await runPipeline(ctx, deps);

    expect(result.status).toBe('dry-run');
    expect(deps.feasibility).not.toHaveBeenCalled();
  });

  it('stops after feasibility failure', async () => {
    const deps = makeDeps({
      feasibility: vi.fn().mockResolvedValue({ ok: false }),
    });
    const result = await runPipeline(makeCtx(), deps);

    expect(result.status).toBe('aborted');
    expect(result.phase).toBe('feasibility');
    expect(deps.branchSetup).not.toHaveBeenCalled();
  });

  it('stops after branch-setup failure', async () => {
    const deps = makeDeps({
      branchSetup: vi.fn().mockResolvedValue({ ok: false }),
    });
    const result = await runPipeline(makeCtx(), deps);

    expect(result.status).toBe('aborted');
    expect(result.phase).toBe('branch-setup');
    expect(deps.transition).not.toHaveBeenCalled();
  });

  it('stops after invoke failure', async () => {
    const deps = makeDeps({
      invoke: vi.fn().mockResolvedValue(false),
    });
    const result = await runPipeline(makeCtx(), deps);

    expect(result.status).toBe('aborted');
    expect(result.phase).toBe('invoke');
    expect(deps.deliver).not.toHaveBeenCalled();
  });

  it('stops after deliver failure', async () => {
    const deps = makeDeps({
      deliver: vi.fn().mockResolvedValue({ ok: false }),
    });
    const result = await runPipeline(makeCtx(), deps);

    expect(result.status).toBe('aborted');
    expect(result.phase).toBe('deliver');
    expect(deps.cost).not.toHaveBeenCalled();
    expect(deps.cleanup).not.toHaveBeenCalled();
  });
});

// ─── Informational phases (never abort) ──────────────────────────────────────

describe('runPipeline — informational phases', () => {
  it('continues after epic-completion regardless of results', async () => {
    const deps = makeDeps({
      epicCompletion: vi
        .fn()
        .mockResolvedValue({ results: [{ epicKey: 'PROJ-100', ok: true }] }),
    });
    const result = await runPipeline(makeCtx(), deps);

    expect(result.status).toBe('completed');
    expect(deps.prRetry).toHaveBeenCalledOnce();
  });

  it('continues after rework-detection regardless of result', async () => {
    const deps = makeDeps({
      reworkDetection: vi
        .fn()
        .mockResolvedValue({ detected: true, ticketKey: 'PROJ-1' }),
    });
    const result = await runPipeline(makeCtx(), deps);

    expect(result.status).toBe('completed');
    expect(deps.ticketFetch).toHaveBeenCalledOnce();
  });

  it('continues after transition failure', async () => {
    const deps = makeDeps({
      transition: vi.fn().mockResolvedValue({ ok: false }),
    });
    const result = await runPipeline(makeCtx(), deps);

    expect(result.status).toBe('completed');
    expect(deps.invoke).toHaveBeenCalledOnce();
  });
});

// ─── Error handling ──────────────────────────────────────────────────────────

describe('runPipeline — error handling', () => {
  it('catches unexpected errors and returns error result', async () => {
    const deps = makeDeps({
      branchSetup: vi.fn().mockRejectedValue(new Error('git exploded')),
    });
    const result = await runPipeline(makeCtx(), deps);

    expect(result.status).toBe('error');
    expect(result.error).toBe('git exploded');
  });

  it('restores original branch on error', async () => {
    const ctx = makeCtx();
    ctx.setBranchSetup({
      ticketBranch: 'feat/test',
      targetBranch: 'main',
      effectiveTarget: 'main',
      originalBranch: 'develop',
    });
    const deps = makeDeps({
      invoke: vi.fn().mockRejectedValue(new Error('crash')),
    });
    await runPipeline(ctx, deps);

    expect(deps.checkout).toHaveBeenCalledWith('develop');
  });

  it('does not restore branch when originalBranch is not set', async () => {
    const deps = makeDeps({
      preflight: vi.fn().mockRejectedValue(new Error('boom')),
    });
    await runPipeline(makeCtx(), deps);

    expect(deps.checkout).not.toHaveBeenCalled();
  });
});

// ─── Cleanup (finally block) ────────────────────────────────────────────────

describe('runPipeline — cleanup', () => {
  it('deletes lock and verify-attempt when ctx.lockOwner is true', async () => {
    const ctx = makeCtx();
    ctx.setLockOwner(true);
    const deps = makeDeps();
    await runPipeline(ctx, deps);

    expect(deps.deleteLock).toHaveBeenCalledOnce();
    expect(deps.deleteVerifyAttempt).toHaveBeenCalledOnce();
  });

  it('does not delete lock when ctx.lockOwner is falsy', async () => {
    const deps = makeDeps();
    await runPipeline(makeCtx(), deps);

    expect(deps.deleteLock).not.toHaveBeenCalled();
    expect(deps.deleteVerifyAttempt).not.toHaveBeenCalled();
  });

  it('deletes lock even on error', async () => {
    const ctx = makeCtx();
    ctx.setLockOwner(true);
    const deps = makeDeps({
      invoke: vi.fn().mockRejectedValue(new Error('crash')),
    });
    await runPipeline(ctx, deps);

    expect(deps.deleteLock).toHaveBeenCalledOnce();
    expect(deps.deleteVerifyAttempt).toHaveBeenCalledOnce();
  });

  it('deletes lock even on early exit', async () => {
    const ctx = makeCtx();
    ctx.setLockOwner(true);
    const deps = makeDeps({
      deliver: vi.fn().mockResolvedValue({ ok: false }),
    });
    await runPipeline(ctx, deps);

    expect(deps.deleteLock).toHaveBeenCalledOnce();
  });
});
