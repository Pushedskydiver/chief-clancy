/**
 * Tests for pipeline stop-condition logic.
 *
 * Migrated from terminal's autopilot.test.ts (PR 11c).
 */
import { describe, expect, it } from 'vitest';

import { checkStopCondition, FATAL_ABORT_PHASES } from './stop-condition.js';

// ─── FATAL_ABORT_PHASES ─────────────────────────────────────────────────────

describe('FATAL_ABORT_PHASES', () => {
  it('contains exactly four phases', () => {
    expect(FATAL_ABORT_PHASES.size).toBe(4);
  });

  it.each(['lock-check', 'preflight', 'ticket-fetch', 'branch-setup'])(
    'includes %s',
    (phase) => {
      expect(FATAL_ABORT_PHASES.has(phase)).toBe(true);
    },
  );
});

// ─── checkStopCondition ─────────────────────────────────────────────────────

describe('checkStopCondition', () => {
  // ── Fatal abort phases ──────────────────────────────────────────────

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

  // ── Non-fatal abort phases ──────────────────────────────────────────

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

  // ── Other statuses ──────────────────────────────────────────────────

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
