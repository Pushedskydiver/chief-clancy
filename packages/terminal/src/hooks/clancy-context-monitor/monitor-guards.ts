/**
 * Context monitor guard logic.
 *
 * Pure functions for evaluating context usage and time limits against
 * thresholds, with independent debounce state machines. All I/O is
 * handled by the entry point — these functions take parsed data and
 * return results without side effects.
 */
import { isPlainObject } from '../shared/types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Context remaining % at which a warning fires. */
const WARNING_THRESHOLD = 35;

/** Context remaining % at which a critical alert fires. */
const CRITICAL_THRESHOLD = 25;

/** Bridge metrics older than this (seconds) are ignored. */
const STALE_SECONDS = 60;

/** Tool uses between repeated warnings at the same severity. */
const DEBOUNCE_CALLS = 5;

/** Time elapsed % at which a warning fires. */
const TIME_WARNING_PCT = 80;

/** Time elapsed % at which a critical alert fires. */
const TIME_CRITICAL_PCT = 100;

/** Default time limit in minutes when env var is unset. */
export const DEFAULT_TIME_LIMIT = 30;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Severity = 'warning' | 'critical';

/** Per-guard debounce counters. */
export type GuardDebounce = {
  readonly callsSinceWarn: number;
  readonly lastLevel: Severity | null;
};

/** Combined debounce state persisted to disk. */
export type DebounceState = {
  readonly context: GuardDebounce;
  readonly time: GuardDebounce;
};

/** Context usage metrics from the statusline bridge file. */
export type BridgeMetrics = {
  readonly remaining_percentage: number;
  readonly used_pct: number;
  readonly timestamp?: number;
};

/** Input for the time guard evaluation. */
export type TimeGuardInput = {
  readonly startedAt: string | undefined;
  readonly timeLimitMinutes: number;
  readonly nowMs: number;
};

/** Result from a guard evaluation. */
export type GuardResult = {
  readonly message: string | null;
  readonly debounce: GuardDebounce;
};

// ---------------------------------------------------------------------------
// Debounce decision
// ---------------------------------------------------------------------------

/**
 * Determine whether a warning should fire based on debounce state.
 *
 * Fires on the first breach, every {@link DEBOUNCE_CALLS} breaches after
 * that, or when severity escalates from warning to critical.
 *
 * @param isFirst - Whether this is the first breach detected.
 * @param callsSinceWarn - Number of tool calls since the last warning.
 * @param severityEscalated - Whether severity increased (warning → critical).
 * @returns `true` if a warning should be emitted.
 */
export function shouldFireWarning(
  isFirst: boolean,
  callsSinceWarn: number,
  severityEscalated: boolean,
): boolean {
  return isFirst || callsSinceWarn >= DEBOUNCE_CALLS || severityEscalated;
}

// ---------------------------------------------------------------------------
// Context guard
// ---------------------------------------------------------------------------

/**
 * Evaluate context usage against warning/critical thresholds.
 *
 * @param metrics - Bridge file data, or `null` if unavailable.
 * @param debounce - Current debounce state for the context guard.
 * @param nowSeconds - Current time in seconds (Unix epoch).
 * @returns Guard result with optional message and updated debounce.
 */
export function runContextGuard(
  metrics: BridgeMetrics | null,
  debounce: GuardDebounce,
  nowSeconds: number,
): GuardResult {
  const unchanged: GuardResult = { message: null, debounce };

  if (!metrics) return unchanged;

  const isStale =
    metrics.timestamp !== undefined &&
    nowSeconds - metrics.timestamp > STALE_SECONDS;

  if (isStale) return unchanged;

  const remaining = metrics.remaining_percentage;
  const belowThreshold = remaining <= WARNING_THRESHOLD;

  if (!belowThreshold) return unchanged;

  const updatedCalls = debounce.callsSinceWarn + 1;
  const isCritical = remaining <= CRITICAL_THRESHOLD;
  const currentLevel: Severity = isCritical ? 'critical' : 'warning';
  const isFirst = debounce.lastLevel === null;
  const wasWarning = debounce.lastLevel === 'warning';
  const severityEscalated = isCritical && wasWarning;

  const shouldFire = shouldFireWarning(
    isFirst,
    updatedCalls,
    severityEscalated,
  );

  if (!shouldFire) {
    return {
      message: null,
      debounce: { callsSinceWarn: updatedCalls, lastLevel: debounce.lastLevel },
    };
  }

  const message = isCritical
    ? buildContextCritical(metrics.used_pct, remaining)
    : buildContextWarning(metrics.used_pct, remaining);

  return {
    message,
    debounce: { callsSinceWarn: 0, lastLevel: currentLevel },
  };
}

// ---------------------------------------------------------------------------
// Time guard
// ---------------------------------------------------------------------------

/**
 * Evaluate elapsed time against the configured time limit.
 *
 * @param input - Time guard parameters (startedAt, limit, current time).
 * @param debounce - Current debounce state for the time guard.
 * @returns Guard result with optional message and updated debounce.
 */
export function runTimeGuard(
  input: TimeGuardInput,
  debounce: GuardDebounce,
): GuardResult {
  const unchanged: GuardResult = { message: null, debounce };
  const { startedAt, timeLimitMinutes, nowMs } = input;

  if (!startedAt || timeLimitMinutes <= 0) return unchanged;

  const startTime = new Date(startedAt).getTime();
  const invalidDate = isNaN(startTime);

  if (invalidDate) return unchanged;

  const elapsedMs = nowMs - startTime;
  const elapsedMin = Math.floor(elapsedMs / 60_000);
  const limitMs = timeLimitMinutes * 60_000;
  const pct = Math.floor((elapsedMs / limitMs) * 100);

  const belowThreshold = pct < TIME_WARNING_PCT;

  if (belowThreshold) return unchanged;

  const updatedCalls = debounce.callsSinceWarn + 1;
  const isCritical = pct >= TIME_CRITICAL_PCT;
  const currentLevel: Severity = isCritical ? 'critical' : 'warning';
  const isFirst = debounce.lastLevel === null;
  const wasWarning = debounce.lastLevel === 'warning';
  const severityEscalated = isCritical && wasWarning;

  const shouldFire = shouldFireWarning(
    isFirst,
    updatedCalls,
    severityEscalated,
  );

  if (!shouldFire) {
    return {
      message: null,
      debounce: { callsSinceWarn: updatedCalls, lastLevel: debounce.lastLevel },
    };
  }

  const message = isCritical
    ? buildTimeCritical(elapsedMin, timeLimitMinutes)
    : buildTimeWarning(elapsedMin, timeLimitMinutes, pct);

  return {
    message,
    debounce: { callsSinceWarn: 0, lastLevel: currentLevel },
  };
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

const EMPTY_GUARD: GuardDebounce = { callsSinceWarn: 0, lastLevel: null };

/** Default debounce state for a fresh session. */
export const EMPTY_DEBOUNCE: DebounceState = {
  context: EMPTY_GUARD,
  time: EMPTY_GUARD,
};

/**
 * Parse a debounce state JSON string.
 *
 * Returns {@link EMPTY_DEBOUNCE} on any parse failure — safe for
 * missing or corrupt files.
 *
 * @param raw - Raw JSON string from the debounce file.
 * @returns Parsed debounce state, or {@link EMPTY_DEBOUNCE} on failure.
 */
export function parseDebounceState(raw: string): DebounceState {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (!isPlainObject(parsed)) return EMPTY_DEBOUNCE;

    return {
      context: parseGuardDebounce(parsed.context),
      time: parseGuardDebounce(parsed.time),
    };
  } catch {
    return EMPTY_DEBOUNCE;
  }
}

/**
 * Parse a bridge metrics JSON string.
 *
 * Returns `null` on any parse failure — the context guard treats
 * `null` as "no data available".
 *
 * @param raw - Raw JSON string from the bridge file.
 * @returns Parsed metrics, or `null` on failure.
 */
export function parseBridgeMetrics(raw: string): BridgeMetrics | null {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (!isPlainObject(parsed)) return null;

    const remaining = parsed.remaining_percentage;
    const used = parsed.used_pct;

    const hasRequired =
      typeof remaining === 'number' &&
      typeof used === 'number' &&
      Number.isFinite(remaining) &&
      Number.isFinite(used);

    if (!hasRequired) return null;

    const result: BridgeMetrics = {
      remaining_percentage: remaining,
      used_pct: used,
    };

    const timestamp = parsed.timestamp;
    const hasTimestamp =
      typeof timestamp === 'number' && Number.isFinite(timestamp);

    return hasTimestamp ? { ...result, timestamp } : result;
  } catch {
    return null;
  }
}

/**
 * Resolve the time limit from an environment variable string.
 *
 * Returns {@link DEFAULT_TIME_LIMIT} when the env var is undefined
 * or not a finite number.
 *
 * @param env - The `CLANCY_TIME_LIMIT` environment variable value.
 * @returns Parsed time limit in minutes, or {@link DEFAULT_TIME_LIMIT}.
 */
export function resolveTimeLimit(env: string | undefined): number {
  if (env === undefined) return DEFAULT_TIME_LIMIT;

  const parsed = Number(env);
  const isValid = Number.isFinite(parsed);

  return isValid ? parsed : DEFAULT_TIME_LIMIT;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseGuardDebounce(value: unknown): GuardDebounce {
  if (!isPlainObject(value)) return EMPTY_GUARD;

  const rawCalls = value.callsSinceWarn;
  const callsSinceWarn = typeof rawCalls === 'number' ? rawCalls : 0;
  const level = value.lastLevel;
  const validLevel = level === 'warning' || level === 'critical';

  return {
    callsSinceWarn,
    lastLevel: validLevel ? level : null,
  };
}

function buildContextWarning(usedPct: number, remaining: number): string {
  return (
    `CONTEXT WARNING: Usage at ${usedPct}%. Remaining: ${remaining}%. ` +
    'Context is getting limited. Stop exploring and move to implementation. ' +
    'Avoid reading additional files unless strictly necessary. ' +
    'Commit completed work as soon as it is ready.'
  );
}

function buildContextCritical(usedPct: number, remaining: number): string {
  return (
    `CONTEXT CRITICAL: Usage at ${usedPct}%. Remaining: ${remaining}%. ` +
    'Context is nearly exhausted. Stop reading files and wrap up immediately:\n' +
    '1. Commit whatever work is staged on the current feature branch\n' +
    '2. Append a WIP entry to .clancy/progress.txt: ' +
    'YYYY-MM-DD HH:MM | TICKET-KEY | Summary | WIP — context exhausted\n' +
    '3. Inform the user what was completed and what remains.\n' +
    'Do NOT start any new work.'
  );
}

function buildTimeWarning(
  elapsedMin: number,
  limitMin: number,
  pct: number,
): string {
  return (
    `TIME WARNING: Ticket implementation at ${elapsedMin}min of ${limitMin}min limit (${pct}%).\n` +
    'Wrap up implementation and prepare for delivery. Avoid starting new approaches.'
  );
}

function buildTimeCritical(elapsedMin: number, limitMin: number): string {
  return (
    `TIME CRITICAL: Time limit reached (${elapsedMin}min of ${limitMin}min).\n` +
    'STOP implementation immediately. Commit current work, push the branch,\n' +
    'and create the PR with whatever is ready. Log a WIP entry if incomplete.'
  );
}
