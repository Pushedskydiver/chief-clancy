import type {
  BridgeMetrics,
  GuardDebounce,
  TimeGuardInput,
} from './monitor-guards.js';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TIME_LIMIT,
  EMPTY_DEBOUNCE,
  parseBridgeMetrics,
  parseDebounceState,
  resolveTimeLimit,
  runContextGuard,
  runTimeGuard,
  shouldFireWarning,
} from './monitor-guards.js';

// ---------------------------------------------------------------------------
// shouldFireWarning
// ---------------------------------------------------------------------------

describe('shouldFireWarning', () => {
  it('fires on first breach', () => {
    expect(shouldFireWarning(true, 1, false)).toBe(true);
  });

  it('fires when debounce count reaches 5', () => {
    expect(shouldFireWarning(false, 5, false)).toBe(true);
  });

  it('fires on severity escalation', () => {
    expect(shouldFireWarning(false, 1, true)).toBe(true);
  });

  it('does not fire when debounced and not escalated', () => {
    expect(shouldFireWarning(false, 3, false)).toBe(false);
  });

  it('does not fire at count 4', () => {
    expect(shouldFireWarning(false, 4, false)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// runContextGuard
// ---------------------------------------------------------------------------

const freshDebounce: GuardDebounce = { callsSinceWarn: 0, lastLevel: null };
const NOW_SECONDS = 1000;

describe('runContextGuard', () => {
  it('returns null when metrics are null', () => {
    const result = runContextGuard(null, freshDebounce, NOW_SECONDS);

    expect(result.message).toBeNull();
    expect(result.debounce).toEqual(freshDebounce);
  });

  it('returns null when metrics are stale', () => {
    const staleMetrics: BridgeMetrics = {
      remaining_percentage: 20,
      used_pct: 80,
      timestamp: NOW_SECONDS - 61,
    };

    const result = runContextGuard(staleMetrics, freshDebounce, NOW_SECONDS);

    expect(result.message).toBeNull();
  });

  it('returns null when remaining is above threshold', () => {
    const metrics: BridgeMetrics = {
      remaining_percentage: 50,
      used_pct: 50,
      timestamp: NOW_SECONDS - 10,
    };

    const result = runContextGuard(metrics, freshDebounce, NOW_SECONDS);

    expect(result.message).toBeNull();
  });

  it('fires warning on first breach at warning level', () => {
    const metrics: BridgeMetrics = {
      remaining_percentage: 30,
      used_pct: 70,
      timestamp: NOW_SECONDS - 5,
    };

    const result = runContextGuard(metrics, freshDebounce, NOW_SECONDS);

    expect(result.message).toContain('CONTEXT WARNING');
    expect(result.message).toContain('70%');
    expect(result.message).toContain('30%');
    expect(result.debounce.lastLevel).toBe('warning');
    expect(result.debounce.callsSinceWarn).toBe(0);
  });

  it('fires critical on first breach at critical level', () => {
    const metrics: BridgeMetrics = {
      remaining_percentage: 20,
      used_pct: 80,
      timestamp: NOW_SECONDS - 5,
    };

    const result = runContextGuard(metrics, freshDebounce, NOW_SECONDS);

    expect(result.message).toContain('CONTEXT CRITICAL');
    expect(result.message).toContain('80%');
    expect(result.debounce.lastLevel).toBe('critical');
  });

  it('debounces after first warning', () => {
    const warned: GuardDebounce = { callsSinceWarn: 0, lastLevel: 'warning' };
    const metrics: BridgeMetrics = {
      remaining_percentage: 30,
      used_pct: 70,
      timestamp: NOW_SECONDS - 5,
    };

    const result = runContextGuard(metrics, warned, NOW_SECONDS);

    expect(result.message).toBeNull();
    expect(result.debounce.callsSinceWarn).toBe(1);
  });

  it('fires again after 5 debounced calls', () => {
    const warned: GuardDebounce = { callsSinceWarn: 4, lastLevel: 'warning' };
    const metrics: BridgeMetrics = {
      remaining_percentage: 30,
      used_pct: 70,
      timestamp: NOW_SECONDS - 5,
    };

    const result = runContextGuard(metrics, warned, NOW_SECONDS);

    expect(result.message).toContain('CONTEXT WARNING');
    expect(result.debounce.callsSinceWarn).toBe(0);
  });

  it('escalation from warning to critical bypasses debounce', () => {
    const warned: GuardDebounce = { callsSinceWarn: 1, lastLevel: 'warning' };
    const metrics: BridgeMetrics = {
      remaining_percentage: 20,
      used_pct: 80,
      timestamp: NOW_SECONDS - 5,
    };

    const result = runContextGuard(metrics, warned, NOW_SECONDS);

    expect(result.message).toContain('CONTEXT CRITICAL');
    expect(result.debounce.lastLevel).toBe('critical');
    expect(result.debounce.callsSinceWarn).toBe(0);
  });

  it('treats metrics without timestamp as fresh', () => {
    const metrics: BridgeMetrics = {
      remaining_percentage: 30,
      used_pct: 70,
    };

    const result = runContextGuard(metrics, freshDebounce, NOW_SECONDS);

    expect(result.message).toContain('CONTEXT WARNING');
  });

  it('fires at exactly the warning threshold (35%)', () => {
    const metrics: BridgeMetrics = {
      remaining_percentage: 35,
      used_pct: 65,
      timestamp: NOW_SECONDS - 5,
    };

    const result = runContextGuard(metrics, freshDebounce, NOW_SECONDS);

    expect(result.message).toContain('CONTEXT WARNING');
  });

  it('fires critical at exactly the critical threshold (25%)', () => {
    const metrics: BridgeMetrics = {
      remaining_percentage: 25,
      used_pct: 75,
      timestamp: NOW_SECONDS - 5,
    };

    const result = runContextGuard(metrics, freshDebounce, NOW_SECONDS);

    expect(result.message).toContain('CONTEXT CRITICAL');
  });

  it('does not fire at exactly 60 seconds staleness', () => {
    const metrics: BridgeMetrics = {
      remaining_percentage: 20,
      used_pct: 80,
      timestamp: NOW_SECONDS - 60,
    };

    const result = runContextGuard(metrics, freshDebounce, NOW_SECONDS);

    expect(result.message).toContain('CONTEXT CRITICAL');
  });
});

// ---------------------------------------------------------------------------
// runTimeGuard
// ---------------------------------------------------------------------------

const THIRTY_MINUTES_MS = 30 * 60_000;

function timeInput(
  startedAt: string | undefined,
  timeLimitMinutes: number,
  nowMs: number,
): TimeGuardInput {
  return { startedAt, timeLimitMinutes, nowMs };
}

describe('runTimeGuard', () => {
  it('returns null when startedAt is undefined', () => {
    const result = runTimeGuard(
      timeInput(undefined, 30, Date.now()),
      freshDebounce,
    );

    expect(result.message).toBeNull();
  });

  it('returns null when time limit is 0', () => {
    const result = runTimeGuard(
      timeInput('2025-01-01T00:00:00Z', 0, Date.now()),
      freshDebounce,
    );

    expect(result.message).toBeNull();
  });

  it('returns null when startedAt is invalid', () => {
    const result = runTimeGuard(
      timeInput('not-a-date', 30, Date.now()),
      freshDebounce,
    );

    expect(result.message).toBeNull();
  });

  it('returns null when below 80% threshold', () => {
    const start = '2025-01-01T00:00:00Z';
    const startMs = new Date(start).getTime();
    const nowMs = startMs + THIRTY_MINUTES_MS * 0.5; // 50%

    const result = runTimeGuard(timeInput(start, 30, nowMs), freshDebounce);

    expect(result.message).toBeNull();
  });

  it('fires warning at 80% elapsed', () => {
    const start = '2025-01-01T00:00:00Z';
    const startMs = new Date(start).getTime();
    const nowMs = startMs + THIRTY_MINUTES_MS * 0.85; // 85%

    const result = runTimeGuard(timeInput(start, 30, nowMs), freshDebounce);

    expect(result.message).toContain('TIME WARNING');
    expect(result.message).toContain('30min');
    expect(result.debounce.lastLevel).toBe('warning');
  });

  it('fires critical at 100% elapsed', () => {
    const start = '2025-01-01T00:00:00Z';
    const startMs = new Date(start).getTime();
    const nowMs = startMs + THIRTY_MINUTES_MS * 1.1; // 110%

    const result = runTimeGuard(timeInput(start, 30, nowMs), freshDebounce);

    expect(result.message).toContain('TIME CRITICAL');
    expect(result.debounce.lastLevel).toBe('critical');
  });

  it('debounces after first time warning', () => {
    const warned: GuardDebounce = { callsSinceWarn: 0, lastLevel: 'warning' };
    const start = '2025-01-01T00:00:00Z';
    const startMs = new Date(start).getTime();
    const nowMs = startMs + THIRTY_MINUTES_MS * 0.85;

    const result = runTimeGuard(timeInput(start, 30, nowMs), warned);

    expect(result.message).toBeNull();
    expect(result.debounce.callsSinceWarn).toBe(1);
  });

  it('escalation from warning to critical bypasses debounce', () => {
    const warned: GuardDebounce = { callsSinceWarn: 1, lastLevel: 'warning' };
    const start = '2025-01-01T00:00:00Z';
    const startMs = new Date(start).getTime();
    const nowMs = startMs + THIRTY_MINUTES_MS * 1.1;

    const result = runTimeGuard(timeInput(start, 30, nowMs), warned);

    expect(result.message).toContain('TIME CRITICAL');
    expect(result.debounce.callsSinceWarn).toBe(0);
  });

  it('returns null when time limit is negative', () => {
    const result = runTimeGuard(
      timeInput('2025-01-01T00:00:00Z', -5, Date.now()),
      freshDebounce,
    );

    expect(result.message).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseDebounceState
// ---------------------------------------------------------------------------

describe('parseDebounceState', () => {
  it('returns empty state for invalid JSON', () => {
    expect(parseDebounceState('not json')).toEqual(EMPTY_DEBOUNCE);
  });

  it('returns empty state for JSON array', () => {
    expect(parseDebounceState('[1,2]')).toEqual(EMPTY_DEBOUNCE);
  });

  it('returns empty state for empty object', () => {
    const result = parseDebounceState('{}');

    expect(result.context).toEqual(freshDebounce);
    expect(result.time).toEqual(freshDebounce);
  });

  it('parses valid debounce state', () => {
    const raw = JSON.stringify({
      context: { callsSinceWarn: 3, lastLevel: 'warning' },
      time: { callsSinceWarn: 1, lastLevel: 'critical' },
    });

    const result = parseDebounceState(raw);

    expect(result.context.callsSinceWarn).toBe(3);
    expect(result.context.lastLevel).toBe('warning');
    expect(result.time.callsSinceWarn).toBe(1);
    expect(result.time.lastLevel).toBe('critical');
  });

  it('defaults invalid lastLevel to null', () => {
    const raw = JSON.stringify({
      context: { callsSinceWarn: 2, lastLevel: 'unknown' },
    });

    const result = parseDebounceState(raw);

    expect(result.context.lastLevel).toBeNull();
    expect(result.context.callsSinceWarn).toBe(2);
  });

  it('defaults non-numeric callsSinceWarn to 0', () => {
    const raw = JSON.stringify({
      context: { callsSinceWarn: 'three', lastLevel: 'warning' },
    });

    const result = parseDebounceState(raw);

    expect(result.context.callsSinceWarn).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// parseBridgeMetrics
// ---------------------------------------------------------------------------

describe('parseBridgeMetrics', () => {
  it('returns null for invalid JSON', () => {
    expect(parseBridgeMetrics('not json')).toBeNull();
  });

  it('returns null for JSON array', () => {
    expect(parseBridgeMetrics('[1,2]')).toBeNull();
  });

  it('returns null when remaining_percentage is missing', () => {
    expect(parseBridgeMetrics(JSON.stringify({ used_pct: 70 }))).toBeNull();
  });

  it('returns null when used_pct is missing', () => {
    expect(
      parseBridgeMetrics(JSON.stringify({ remaining_percentage: 30 })),
    ).toBeNull();
  });

  it('parses valid metrics without timestamp', () => {
    const raw = JSON.stringify({
      remaining_percentage: 30,
      used_pct: 70,
    });

    const result = parseBridgeMetrics(raw);

    expect(result).toEqual({ remaining_percentage: 30, used_pct: 70 });
  });

  it('parses valid metrics with timestamp', () => {
    const raw = JSON.stringify({
      remaining_percentage: 30,
      used_pct: 70,
      timestamp: 1234567890,
    });

    const result = parseBridgeMetrics(raw);

    expect(result).toEqual({
      remaining_percentage: 30,
      used_pct: 70,
      timestamp: 1234567890,
    });
  });

  it('ignores non-numeric timestamp', () => {
    const raw = JSON.stringify({
      remaining_percentage: 30,
      used_pct: 70,
      timestamp: 'not-a-number',
    });

    const result = parseBridgeMetrics(raw);

    expect(result).toEqual({ remaining_percentage: 30, used_pct: 70 });
  });
});

// ---------------------------------------------------------------------------
// resolveTimeLimit
// ---------------------------------------------------------------------------

describe('resolveTimeLimit', () => {
  it('returns default when env is undefined', () => {
    expect(resolveTimeLimit(undefined)).toBe(DEFAULT_TIME_LIMIT);
  });

  it('parses a valid numeric string', () => {
    expect(resolveTimeLimit('45')).toBe(45);
  });

  it('returns default for non-numeric string', () => {
    expect(resolveTimeLimit('abc')).toBe(DEFAULT_TIME_LIMIT);
  });

  it('treats empty string as 0 (Number coercion)', () => {
    expect(resolveTimeLimit('')).toBe(0);
  });

  it('accepts zero as a valid value', () => {
    expect(resolveTimeLimit('0')).toBe(0);
  });
});
