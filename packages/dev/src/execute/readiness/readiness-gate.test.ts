/**
 * Tests for the readiness gate — grade ticket, retry on yellow, refuse on red.
 */
import type {
  CheckResult,
  ReadinessVerdict,
} from '../../agents/types/index.js';

import { describe, expect, it, vi } from 'vitest';

import { runReadinessGate } from './readiness-gate.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeVerdict(
  overall: 'green' | 'yellow' | 'red',
  checks?: readonly CheckResult[],
): ReadinessVerdict {
  const defaultChecks: readonly CheckResult[] = [
    { id: 'clear', verdict: overall, reason: `${overall} clear` },
    { id: 'testable', verdict: 'green', reason: 'testable' },
    { id: 'small', verdict: 'green', reason: 'small' },
    { id: 'locatable', verdict: 'green', reason: 'locatable' },
    { id: 'touch-bounded', verdict: 'green', reason: 'bounded' },
  ];

  return {
    ticketId: 'PROJ-42',
    overall,
    checks: checks ?? defaultChecks,
    gradedAt: '2026-04-11T00:00:00Z',
    rubricSha: 'abc123',
  };
}

function makeGrader(...verdicts: readonly ReadinessVerdict[]) {
  const calls = [...verdicts];
  return vi.fn(() => {
    const next = calls.shift();
    if (!next) throw new Error('No more verdicts');
    return { ok: true as const, verdict: next };
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('runReadinessGate', () => {
  it('returns pass when verdict is green', () => {
    const grade = makeGrader(makeVerdict('green'));

    const result = runReadinessGate({ grade, maxRounds: 3 });

    expect(result.passed).toBe(true);
    expect(grade).toHaveBeenCalledOnce();
  });

  it('returns fail with checks when verdict is red', () => {
    const grade = makeGrader(makeVerdict('red'));

    const result = runReadinessGate({ grade, maxRounds: 3 });

    expect(result.passed).toBe(false);
    if (!result.passed) {
      expect(result.overall).toBe('red');
    }
    expect(grade).toHaveBeenCalledOnce();
  });

  it('retries on yellow and passes if next grade is green', () => {
    const grade = makeGrader(makeVerdict('yellow'), makeVerdict('green'));

    const result = runReadinessGate({ grade, maxRounds: 3 });

    expect(result.passed).toBe(true);
    expect(grade).toHaveBeenCalledTimes(2);
  });

  it('retries on yellow and fails if still yellow after max rounds', () => {
    const grade = makeGrader(
      makeVerdict('yellow'),
      makeVerdict('yellow'),
      makeVerdict('yellow'),
    );

    const result = runReadinessGate({ grade, maxRounds: 3 });

    expect(result.passed).toBe(false);
    if (!result.passed) {
      expect(result.overall).toBe('yellow');
    }
    expect(grade).toHaveBeenCalledTimes(3);
  });

  it('does not retry on red', () => {
    const grade = makeGrader(makeVerdict('red'));

    runReadinessGate({ grade, maxRounds: 3 });

    expect(grade).toHaveBeenCalledOnce();
  });

  it('returns fail when grader returns error', () => {
    const grade = vi.fn(() => ({
      ok: false as const,
      error: 'Claude crashed',
    }));

    const result = runReadinessGate({ grade, maxRounds: 3 });

    expect(result.passed).toBe(false);
    if (!result.passed) {
      expect(result.error).toBe('Claude crashed');
    }
  });

  it('caps retries at maxRounds', () => {
    const grade = makeGrader(makeVerdict('yellow'), makeVerdict('yellow'));

    const result = runReadinessGate({ grade, maxRounds: 2 });

    expect(result.passed).toBe(false);
    expect(grade).toHaveBeenCalledTimes(2);
  });

  it('includes questions from yellow checks in fail result', () => {
    const checks: readonly CheckResult[] = [
      {
        id: 'clear',
        verdict: 'yellow',
        reason: 'Vague',
        question: 'What does this do?',
      },
      { id: 'testable', verdict: 'green', reason: 'OK' },
      { id: 'small', verdict: 'green', reason: 'OK' },
      { id: 'locatable', verdict: 'green', reason: 'OK' },
      { id: 'touch-bounded', verdict: 'green', reason: 'OK' },
    ];
    const grade = makeGrader(makeVerdict('yellow', checks));

    const result = runReadinessGate({ grade, maxRounds: 1 });

    expect(result.passed).toBe(false);
    if (!result.passed) {
      expect(result.verdict?.checks[0]?.question).toBe('What does this do?');
    }
  });
});
