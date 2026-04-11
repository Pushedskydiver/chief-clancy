import { describe, expect, it, vi } from 'vitest';

import { checkStopCondition, runAutopilot } from './autopilot.js';

// ─── checkStopCondition ──────────────────────────────────────────────────────

describe('checkStopCondition', () => {
  // ── Fatal abort phases ────────────────────────────────────────────────

  it('stops on aborted at preflight', () => {
    const result = checkStopCondition({
      status: 'aborted',
      phase: 'preflight',
    });
    expect(result.stop).toBe(true);
  });

  it('stops on aborted at ticket-fetch', () => {
    const result = checkStopCondition({
      status: 'aborted',
      phase: 'ticket-fetch',
    });
    expect(result.stop).toBe(true);
  });

  it('stops on aborted at lock-check', () => {
    const result = checkStopCondition({
      status: 'aborted',
      phase: 'lock-check',
    });
    expect(result.stop).toBe(true);
  });

  it('stops on aborted at branch-setup', () => {
    const result = checkStopCondition({
      status: 'aborted',
      phase: 'branch-setup',
    });
    expect(result.stop).toBe(true);
  });

  // ── Non-fatal abort phases ────────────────────────────────────────────

  it('continues on aborted at feasibility', () => {
    const result = checkStopCondition({
      status: 'aborted',
      phase: 'feasibility',
    });
    expect(result.stop).toBe(false);
  });

  it('continues on aborted at invoke', () => {
    const result = checkStopCondition({
      status: 'aborted',
      phase: 'invoke',
    });
    expect(result.stop).toBe(false);
  });

  // ── Other statuses ────────────────────────────────────────────────────

  it('stops on error', () => {
    const result = checkStopCondition({
      status: 'error',
      error: 'Something broke',
    });
    expect(result.stop).toBe(true);
    if (result.stop) expect(result.reason).toContain('Something broke');
  });

  it('does not stop on completed', () => {
    expect(checkStopCondition({ status: 'completed' }).stop).toBe(false);
  });

  it('does not stop on resumed', () => {
    expect(checkStopCondition({ status: 'resumed' }).stop).toBe(false);
  });

  it('stops on dry-run', () => {
    expect(checkStopCondition({ status: 'dry-run' }).stop).toBe(true);
  });

  // ── Edge cases ──────────────────────────────────────────────────────

  it('continues on aborted with phase undefined', () => {
    const result = checkStopCondition({ status: 'aborted' });
    expect(result.stop).toBe(false);
  });

  it('uses fallback reason when error is undefined', () => {
    const result = checkStopCondition({ status: 'error' });
    expect(result.stop).toBe(true);
    if (result.stop) expect(result.reason).toBe('Unknown error');
  });
});

// ─── runAutopilot ────────────────────────────────────────────────────────────

type AutopilotOpts = Parameters<typeof runAutopilot>[0];

function createMockOpts(overrides?: Partial<AutopilotOpts>): AutopilotOpts {
  return {
    maxIterations: 3,
    runIteration: vi.fn().mockResolvedValue({ status: 'completed' }),
    buildReport: vi.fn().mockReturnValue('# Report'),
    sendNotification: vi.fn().mockResolvedValue(undefined),
    sleep: vi.fn().mockResolvedValue(undefined),
    console: { log: vi.fn(), error: vi.fn() },
    clock: () => 1000,
    quietStart: undefined,
    quietEnd: undefined,
    webhookUrl: undefined,
    ...overrides,
  } as unknown as AutopilotOpts;
}

describe('runAutopilot', () => {
  it('runs up to maxIterations', async () => {
    const runIteration = vi.fn().mockResolvedValue({ status: 'completed' });
    const opts = createMockOpts({ maxIterations: 3, runIteration });

    await runAutopilot(opts);

    expect(runIteration).toHaveBeenCalledTimes(3);
  });

  it('stops early on error result', async () => {
    const runIteration = vi
      .fn()
      .mockResolvedValueOnce({ status: 'completed' })
      .mockResolvedValueOnce({ status: 'error', error: 'crash' });
    const opts = createMockOpts({ maxIterations: 5, runIteration });

    await runAutopilot(opts);

    expect(runIteration).toHaveBeenCalledTimes(2);
  });

  it('stops on preflight abort', async () => {
    const runIteration = vi
      .fn()
      .mockResolvedValue({ status: 'aborted', phase: 'preflight' });
    const opts = createMockOpts({ runIteration });

    await runAutopilot(opts);

    expect(runIteration).toHaveBeenCalledTimes(1);
  });

  it('continues on feasibility abort (skip to next ticket)', async () => {
    const runIteration = vi
      .fn()
      .mockResolvedValueOnce({ status: 'aborted', phase: 'feasibility' })
      .mockResolvedValueOnce({ status: 'completed' })
      .mockResolvedValueOnce({ status: 'completed' });
    const opts = createMockOpts({ maxIterations: 3, runIteration });

    await runAutopilot(opts);

    expect(runIteration).toHaveBeenCalledTimes(3);
  });

  it('generates report after loop ends', async () => {
    const buildReport = vi.fn().mockReturnValue('# Report');
    const opts = createMockOpts({ maxIterations: 1, buildReport });

    await runAutopilot(opts);

    expect(buildReport).toHaveBeenCalledWith(1000, 1000);
  });

  it('sends webhook with summary data', async () => {
    const sendNotification = vi.fn().mockResolvedValue(undefined);
    const buildReport = vi
      .fn()
      .mockReturnValue(
        '# Report\n\n## Summary\n- Tickets completed: 1\n- Total duration: 5m',
      );
    const opts = createMockOpts({
      maxIterations: 1,
      webhookUrl: 'https://hooks.slack.com/x',
      sendNotification,
      buildReport,
    });

    await runAutopilot(opts);

    expect(sendNotification).toHaveBeenCalledWith(
      'https://hooks.slack.com/x',
      expect.stringContaining('Tickets completed'),
    );
  });

  it('extracts summary from report with \\r\\n line endings', async () => {
    const sendNotification = vi.fn().mockResolvedValue(undefined);
    const buildReport = vi
      .fn()
      .mockReturnValue(
        '# Report\r\n\r\n## Summary\r\n- Tickets completed: 2\r\n- Total duration: 10m',
      );
    const opts = createMockOpts({
      maxIterations: 1,
      webhookUrl: 'https://hooks.slack.com/x',
      sendNotification,
      buildReport,
    });

    await runAutopilot(opts);

    expect(sendNotification).toHaveBeenCalledWith(
      'https://hooks.slack.com/x',
      expect.stringContaining('Tickets completed'),
    );
  });

  it('sends fallback message when report has no summary lines', async () => {
    const sendNotification = vi.fn().mockResolvedValue(undefined);
    const buildReport = vi.fn().mockReturnValue('# Report\n\nNo data.');
    const opts = createMockOpts({
      maxIterations: 1,
      webhookUrl: 'https://hooks.slack.com/x',
      sendNotification,
      buildReport,
    });

    await runAutopilot(opts);

    expect(sendNotification).toHaveBeenCalledWith(
      'https://hooks.slack.com/x',
      expect.stringContaining('session complete'),
    );
  });

  it('does not send webhook when URL is not configured', async () => {
    const sendNotification = vi.fn();
    const opts = createMockOpts({
      maxIterations: 1,
      webhookUrl: undefined,
      sendNotification,
    });

    await runAutopilot(opts);

    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('warns and completes when webhook notification fails', async () => {
    const sendNotification = vi
      .fn()
      .mockRejectedValue(new Error('ECONNREFUSED'));
    const consoleMock = { log: vi.fn(), error: vi.fn() };
    const opts = createMockOpts({
      maxIterations: 1,
      webhookUrl: 'https://hooks.slack.com/x',
      sendNotification,
      console: consoleMock,
    });

    await expect(runAutopilot(opts)).resolves.toBeUndefined();
    expect(consoleMock.error).toHaveBeenCalledWith(
      expect.stringContaining('Webhook notification failed'),
    );
  });

  it('sleeps between iterations', async () => {
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const opts = createMockOpts({ maxIterations: 2, sleep: sleepFn });

    await runAutopilot(opts);

    expect(sleepFn).toHaveBeenCalledWith(2000);
  });

  it('does not sleep after last iteration', async () => {
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const opts = createMockOpts({ maxIterations: 1, sleep: sleepFn });

    await runAutopilot(opts);

    expect(sleepFn).not.toHaveBeenCalledWith(2000);
  });
});
