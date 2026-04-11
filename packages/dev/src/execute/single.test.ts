/**
 * Tests for the single-ticket executor.
 *
 * Verifies the pre-seed pattern: hydrate ticket by key, create context
 * with ticket pre-set, then run the pipeline (which skips ticket-fetch
 * because ctx.ticket is already populated).
 */
import type { PipelineDeps, PipelineResult } from '../pipeline/index.js';
import type { FetchedTicket } from '@chief-clancy/core';

import { describe, expect, it, vi } from 'vitest';

import { runSingleTicketByKey } from './single.js';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const TICKET: FetchedTicket = {
  key: 'PROJ-42',
  title: 'Add login page',
  description: 'Create a login page with email/password fields.',
  parentInfo: 'PROJ-10',
  blockers: 'none',
};

function makeDeps(
  overrides: {
    readonly fetchTicketByKeyOnce?: (
      key: string,
    ) => Promise<FetchedTicket | undefined>;
    readonly runPipeline?: (
      ...args: readonly unknown[]
    ) => Promise<PipelineResult>;
  } = {},
) {
  return {
    fetchTicketByKeyOnce:
      overrides.fetchTicketByKeyOnce ?? vi.fn().mockResolvedValue(TICKET),
    pipelineDeps: {} as PipelineDeps,
    runPipeline:
      overrides.runPipeline ??
      vi.fn<() => Promise<PipelineResult>>().mockResolvedValue({
        status: 'completed' as const,
      }),
    projectRoot: '/tmp/test-project',
    argv: [] as readonly string[],
    isAfk: false,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('runSingleTicketByKey', () => {
  it('returns error when ticket is not found', async () => {
    const deps = makeDeps({
      fetchTicketByKeyOnce: vi.fn().mockResolvedValue(undefined),
    });

    const result = await runSingleTicketByKey('PROJ-999', deps);

    expect(result).toEqual({
      status: 'error',
      error: 'Ticket PROJ-999 not found on board',
    });
  });

  it('calls runPipeline when ticket is found', async () => {
    const deps = makeDeps();

    const result = await runSingleTicketByKey('PROJ-42', deps);

    expect(result).toEqual({ status: 'completed' });
    expect(deps.runPipeline).toHaveBeenCalledOnce();
  });

  it('pre-seeds ctx.ticket so ticket-fetch phase is skipped', async () => {
    const deps = makeDeps();

    await runSingleTicketByKey('PROJ-42', deps);

    // The RunContext passed to runPipeline should have ticket pre-set
    const ctx = vi.mocked(deps.runPipeline).mock.calls[0]![0] as {
      readonly ticket: FetchedTicket | undefined;
    };
    expect(ctx.ticket).toEqual(TICKET);
  });

  it('passes pipelineDeps to runPipeline', async () => {
    const deps = makeDeps();

    await runSingleTicketByKey('PROJ-42', deps);

    const passedDeps = vi.mocked(deps.runPipeline).mock.calls[0]![1];
    expect(passedDeps).toBe(deps.pipelineDeps);
  });

  it('passes projectRoot to context', async () => {
    const deps = makeDeps();

    await runSingleTicketByKey('PROJ-42', deps);

    const ctx = vi.mocked(deps.runPipeline).mock.calls[0]![0] as {
      readonly projectRoot: string;
    };
    expect(ctx.projectRoot).toBe('/tmp/test-project');
  });

  it('passes argv to context', async () => {
    const depsWithArgv = {
      ...makeDeps(),
      argv: ['--dry-run'] as readonly string[],
    };

    await runSingleTicketByKey('PROJ-42', depsWithArgv);

    const ctx = vi.mocked(depsWithArgv.runPipeline).mock.calls[0]![0] as {
      readonly argv: readonly string[];
    };
    expect(ctx.argv).toEqual(['--dry-run']);
  });

  it('passes isAfk to context', async () => {
    const deps = { ...makeDeps(), isAfk: true };

    await runSingleTicketByKey('PROJ-42', deps);

    const ctx = vi.mocked(deps.runPipeline).mock.calls[0]![0] as {
      readonly isAfk: boolean;
    };
    expect(ctx.isAfk).toBe(true);
  });

  it('propagates pipeline error result', async () => {
    const deps = makeDeps({
      runPipeline: vi
        .fn()
        .mockResolvedValue({ status: 'error', error: 'branch-setup failed' }),
    });

    const result = await runSingleTicketByKey('PROJ-42', deps);

    expect(result).toEqual({
      status: 'error',
      error: 'branch-setup failed',
    });
  });

  it('propagates pipeline aborted result', async () => {
    const deps = makeDeps({
      runPipeline: vi
        .fn()
        .mockResolvedValue({ status: 'aborted', phase: 'preflight' }),
    });

    const result = await runSingleTicketByKey('PROJ-42', deps);

    expect(result).toEqual({ status: 'aborted', phase: 'preflight' });
  });

  it('does not call runPipeline when ticket lookup fails', async () => {
    const runPipeline = vi.fn();
    const deps = makeDeps({
      fetchTicketByKeyOnce: vi.fn().mockResolvedValue(undefined),
      runPipeline,
    });

    await runSingleTicketByKey('PROJ-999', deps);

    expect(runPipeline).not.toHaveBeenCalled();
  });

  it('passes the ticket key to fetchTicketByKeyOnce', async () => {
    const fetchTicketByKeyOnce = vi.fn().mockResolvedValue(TICKET);
    const deps = makeDeps({ fetchTicketByKeyOnce });

    await runSingleTicketByKey('ENG-777', deps);

    expect(fetchTicketByKeyOnce).toHaveBeenCalledWith('ENG-777');
  });

  it('returns structured error when ticket lookup throws', async () => {
    const deps = makeDeps({
      fetchTicketByKeyOnce: vi
        .fn()
        .mockRejectedValue(new Error('Network timeout')),
    });

    const result = await runSingleTicketByKey('PROJ-42', deps);

    expect(result).toEqual({
      status: 'error',
      error: 'Ticket lookup failed: Network timeout',
    });
  });

  it('runs pipeline when ticket has an optional status field', async () => {
    const ticketWithStatus: FetchedTicket = {
      ...TICKET,
      status: 'In Progress',
    };
    const deps = makeDeps({
      fetchTicketByKeyOnce: vi.fn().mockResolvedValue(ticketWithStatus),
    });

    const result = await runSingleTicketByKey('PROJ-42', deps);

    expect(result).toEqual({ status: 'completed' });
    expect(deps.runPipeline).toHaveBeenCalledOnce();
  });

  it('does not call runPipeline when ticket lookup throws', async () => {
    const runPipeline = vi.fn();
    const deps = makeDeps({
      fetchTicketByKeyOnce: vi.fn().mockRejectedValue(new Error('Auth failed')),
      runPipeline,
    });

    await runSingleTicketByKey('PROJ-42', deps);

    expect(runPipeline).not.toHaveBeenCalled();
  });

  // ── Readiness gate integration ──────────────────────────────────────────

  it('runs pipeline when readiness gate passes', async () => {
    const deps = {
      ...makeDeps(),
      readinessGate: vi.fn().mockReturnValue({ passed: true, verdict: {} }),
    };

    const result = await runSingleTicketByKey('PROJ-42', deps);

    expect(result).toEqual({ status: 'completed' });
    expect(deps.readinessGate).toHaveBeenCalledOnce();
    expect(deps.runPipeline).toHaveBeenCalledOnce();
  });

  it('returns error when readiness gate fails', async () => {
    const deps = {
      ...makeDeps(),
      readinessGate: vi
        .fn()
        .mockReturnValue({ passed: false, overall: 'red', error: undefined }),
    };

    const result = await runSingleTicketByKey('PROJ-42', deps);

    expect(result.status).toBe('aborted');
    if (result.status === 'aborted') {
      expect(result.phase).toBe('readiness');
    }
    expect(deps.runPipeline).not.toHaveBeenCalled();
  });

  it('skips readiness gate when not provided', async () => {
    const deps = makeDeps();

    const result = await runSingleTicketByKey('PROJ-42', deps);

    expect(result).toEqual({ status: 'completed' });
  });

  it('skips readiness gate when bypass flag is set', async () => {
    const readinessGate = vi.fn();
    const deps = {
      ...makeDeps(),
      readinessGate,
      argv: ['--bypass-readiness', '--reason=testing'] as readonly string[],
    };

    const result = await runSingleTicketByKey('PROJ-42', deps);

    expect(result).toEqual({ status: 'completed' });
    expect(readinessGate).not.toHaveBeenCalled();
  });

  it('returns error when bypass flags are invalid', async () => {
    const deps = {
      ...makeDeps(),
      readinessGate: vi.fn(),
      argv: ['--bypass-readiness'] as readonly string[],
    };

    const result = await runSingleTicketByKey('PROJ-42', deps);

    expect(result.status).toBe('error');
  });
});
