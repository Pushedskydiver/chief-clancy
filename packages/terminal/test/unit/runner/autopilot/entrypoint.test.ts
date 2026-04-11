/**
 * Autopilot entrypoint adapter tests.
 *
 * Verifies env var parsing and the iteration/report closures
 * that wire real Node.js APIs into runAutopilot.
 */
import type { PipelineResult } from '@chief-clancy/dev';

import {
  buildNotify,
  buildReportFactory,
  buildRunIteration,
  parseMaxIterations,
} from '~/t/runner/autopilot/entrypoint.js';
import { describe, expect, it, vi } from 'vitest';

// ─── parseMaxIterations ─────────────────────────────────────────────────────

describe('parseMaxIterations', () => {
  it('returns default 5 when env var is undefined', () => {
    expect(parseMaxIterations(undefined)).toBe(5);
  });

  it('parses a valid integer string', () => {
    expect(parseMaxIterations('10')).toBe(10);
  });

  it('returns default 5 for non-numeric string', () => {
    expect(parseMaxIterations('abc')).toBe(5);
  });

  it('returns default 5 for empty string', () => {
    expect(parseMaxIterations('')).toBe(5);
  });

  it('returns default 5 for zero', () => {
    expect(parseMaxIterations('0')).toBe(5);
  });

  it('returns default 5 for negative values', () => {
    expect(parseMaxIterations('-3')).toBe(5);
  });

  it('floors decimal values', () => {
    expect(parseMaxIterations('3.7')).toBe(3);
  });
});

// ─── buildRunIteration ──────────────────────────────────────────────────────

describe('buildRunIteration', () => {
  it('calls runPipeline with isAfk true and returns the result', async () => {
    const expectedResult: PipelineResult = { status: 'completed' };
    const runPipeline = vi.fn().mockResolvedValue(expectedResult);

    const runIteration = buildRunIteration({
      projectRoot: '/project',
      exec: vi.fn(),
      lockFs: {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        deleteFile: vi.fn(),
        mkdir: vi.fn(),
      },
      progressFs: { readFile: vi.fn(), appendFile: vi.fn(), mkdir: vi.fn() },
      costFs: { appendFile: vi.fn(), mkdir: vi.fn() },
      envFs: { readFile: vi.fn() },
      qualityFs: {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        rename: vi.fn(),
        mkdir: vi.fn(),
      },
      spawn: vi.fn(),
      fetch: vi.fn(),
      runPipeline,
      argv: ['node', 'script.js'],
    });

    const result = await runIteration();

    expect(result).toBe(expectedResult);
    expect(runPipeline).toHaveBeenCalledOnce();

    const ctx = runPipeline.mock.calls[0][0] as { readonly isAfk: boolean };
    expect(ctx.isAfk).toBe(true);
  });
});

// ─── buildReportFactory ─────────────────────────────────────────────────────

describe('buildReportFactory', () => {
  it('delegates to buildSessionReport with correct timing', () => {
    const mockBuildReport = vi.fn().mockReturnValue('# Report');

    const factory = buildReportFactory({
      progressFs: { readFile: vi.fn(), appendFile: vi.fn(), mkdir: vi.fn() },
      qualityFs: {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        rename: vi.fn(),
        mkdir: vi.fn(),
      },
      projectRoot: '/project',
      console: { log: vi.fn(), error: vi.fn() },
      readCostsFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      buildSessionReport: mockBuildReport,
    });

    const result = factory(1000, 2000);

    expect(result).toBe('# Report');
    expect(mockBuildReport).toHaveBeenCalledWith(
      expect.objectContaining({
        projectRoot: '/project',
        loopStartTime: 1000,
        loopEndTime: 2000,
      }),
    );
  });
});

// ─── buildNotify ────────────────────────────────────────────────────────────

describe('buildNotify', () => {
  it('calls sendNotification with the correct params', async () => {
    const mockSend = vi.fn().mockResolvedValue(undefined);
    const notify = buildNotify(vi.fn(), mockSend);

    await notify('https://hooks.slack.com/test', 'hello');

    expect(mockSend).toHaveBeenCalledWith({
      webhookUrl: 'https://hooks.slack.com/test',
      message: 'hello',
      fetch: expect.any(Function),
    });
  });
});
