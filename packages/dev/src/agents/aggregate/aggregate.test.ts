/**
 * Tests for the verdict aggregation rule.
 *
 * Aggregation: overall = worst colour across checks.
 * Additional rule: if yellowCount >= threshold, overall escalates to red.
 */
import type { CheckResult } from '../types/index.js';

import { describe, expect, it } from 'vitest';

import { aggregateVerdict } from './aggregate.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function check(
  id: CheckResult['id'],
  verdict: CheckResult['verdict'],
): CheckResult {
  return { id, verdict, reason: `${id} is ${verdict}` };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('aggregateVerdict', () => {
  it('returns green when all checks are green', () => {
    const checks = [
      check('clear', 'green'),
      check('testable', 'green'),
      check('small', 'green'),
      check('locatable', 'green'),
      check('touch-bounded', 'green'),
    ];

    expect(aggregateVerdict(checks)).toBe('green');
  });

  it('returns yellow when one check is yellow', () => {
    const checks = [
      check('clear', 'green'),
      check('testable', 'yellow'),
      check('small', 'green'),
      check('locatable', 'green'),
      check('touch-bounded', 'green'),
    ];

    expect(aggregateVerdict(checks)).toBe('yellow');
  });

  it('returns red when one check is red', () => {
    const checks = [
      check('clear', 'green'),
      check('testable', 'green'),
      check('small', 'red'),
      check('locatable', 'green'),
      check('touch-bounded', 'green'),
    ];

    expect(aggregateVerdict(checks)).toBe('red');
  });

  it('returns red when any check is red even if others are yellow', () => {
    const checks = [
      check('clear', 'yellow'),
      check('testable', 'red'),
      check('small', 'yellow'),
      check('locatable', 'green'),
      check('touch-bounded', 'green'),
    ];

    expect(aggregateVerdict(checks)).toBe('red');
  });

  it('escalates to red when yellow count meets threshold', () => {
    const checks = [
      check('clear', 'yellow'),
      check('testable', 'yellow'),
      check('small', 'yellow'),
      check('locatable', 'green'),
      check('touch-bounded', 'green'),
    ];

    expect(aggregateVerdict(checks, 3)).toBe('red');
  });

  it('stays yellow when yellow count is below threshold', () => {
    const checks = [
      check('clear', 'yellow'),
      check('testable', 'yellow'),
      check('small', 'green'),
      check('locatable', 'green'),
      check('touch-bounded', 'green'),
    ];

    expect(aggregateVerdict(checks, 3)).toBe('yellow');
  });

  it('uses default threshold of 3', () => {
    const checks = [
      check('clear', 'yellow'),
      check('testable', 'yellow'),
      check('small', 'yellow'),
      check('locatable', 'green'),
      check('touch-bounded', 'green'),
    ];

    // Default threshold = 3, so 3 yellows → red
    expect(aggregateVerdict(checks)).toBe('red');
  });

  it('returns green for empty checks array', () => {
    expect(aggregateVerdict([])).toBe('green');
  });
});
