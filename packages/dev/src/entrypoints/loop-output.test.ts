import type { LoopOutcome } from '../index.js';
import type { PipelineResult } from '../pipeline/run-pipeline.js';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sendNotification } from '../notify.js';
import { displayOutcome, notifyIfConfigured } from './loop-output.js';

vi.mock('../notify.js', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeOutcome(
  overrides: Partial<LoopOutcome<PipelineResult>> = {},
): LoopOutcome<PipelineResult> {
  return {
    iterations: [],
    startedAt: 1000,
    endedAt: 2000,
    ...overrides,
  };
}

function makeResult(status: PipelineResult['status']): PipelineResult {
  return { status } as PipelineResult;
}

// ─── displayOutcome ─────────────────────────────────────────────────────────

describe('displayOutcome', () => {
  let logs: string[];

  beforeEach(() => {
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.join(' '));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs ticket counts', () => {
    displayOutcome(makeOutcome(), 5);

    expect(logs.some((l) => l.includes('Tickets queued: 5'))).toBe(true);
    expect(logs.some((l) => l.includes('Tickets processed: 0'))).toBe(true);
  });

  it('logs halt info when present', () => {
    displayOutcome(
      makeOutcome({ haltedAt: { id: 'PROJ-1', reason: 'fatal error' } }),
      3,
    );

    expect(logs.some((l) => l.includes('Halted at: PROJ-1'))).toBe(true);
    expect(logs.some((l) => l.includes('Reason: fatal error'))).toBe(true);
  });

  it('does not log halt info when absent', () => {
    displayOutcome(makeOutcome(), 1);

    expect(logs.some((l) => l.includes('Halted at'))).toBe(false);
  });

  it('logs status icon per iteration', () => {
    displayOutcome(
      makeOutcome({
        iterations: [
          { id: 'PROJ-1', result: makeResult('completed') },
          { id: 'PROJ-2', result: makeResult('aborted') },
          { id: 'PROJ-3', result: makeResult('error') },
        ],
      }),
      3,
    );

    expect(logs.some((l) => l.includes('✅') && l.includes('PROJ-1'))).toBe(
      true,
    );
    expect(logs.some((l) => l.includes('⏹') && l.includes('PROJ-2'))).toBe(
      true,
    );
    expect(logs.some((l) => l.includes('❌') && l.includes('PROJ-3'))).toBe(
      true,
    );
  });
});

// ─── notifyIfConfigured ─────────────────────────────────────────────────────

describe('notifyIfConfigured', () => {
  afterEach(() => {
    vi.mocked(sendNotification).mockClear();
  });

  it('does nothing when webhookUrl is undefined', async () => {
    await notifyIfConfigured(undefined, makeOutcome(), 1);

    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('sends notification with completion message', async () => {
    await notifyIfConfigured(
      'https://hooks.example.com/test',
      makeOutcome({
        iterations: [{ id: 'PROJ-1', result: makeResult('completed') }],
      }),
      3,
    );

    expect(sendNotification).toHaveBeenCalledOnce();
    const call = vi.mocked(sendNotification).mock.calls[0][0];
    expect(call.webhookUrl).toBe('https://hooks.example.com/test');
    expect(call.message).toContain('Loop complete: 1/3 tickets processed');
  });

  it('sends notification with halt message when halted', async () => {
    await notifyIfConfigured(
      'https://hooks.example.com/test',
      makeOutcome({
        iterations: [{ id: 'PROJ-1', result: makeResult('error') }],
        haltedAt: { id: 'PROJ-1', reason: 'Unknown error' },
      }),
      5,
    );

    expect(sendNotification).toHaveBeenCalledOnce();
    const call = vi.mocked(sendNotification).mock.calls[0][0];
    expect(call.message).toContain('Loop halted after 1/5 tickets');
    expect(call.message).toContain('Unknown error');
  });
});
