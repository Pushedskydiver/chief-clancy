/**
 * PostToolUse hook: context monitor.
 *
 * Reads context metrics from the statusline bridge file and time data
 * from the lock file. Injects warnings into Claude's conversation when
 * context runs low or time limits approach. Each guard (context + time)
 * has independent debounce to avoid excessive warnings.
 *
 * Best-effort: any failure exits silently.
 */
import type { HookEvent } from '../shared/types.js';
import type { DebounceState, GuardResult } from './monitor-guards.js';

import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { contextOutput } from '../shared/hook-output/index.js';
import { readLockFile } from '../shared/lock-file/index.js';
import { readAsyncInput } from '../shared/stdin-reader/index.js';
import { bridgePath, debouncePath } from '../shared/tmpdir/index.js';
import {
  EMPTY_DEBOUNCE,
  parseBridgeMetrics,
  parseDebounceState,
  resolveTimeLimit,
  runContextGuard,
  runTimeGuard,
} from './monitor-guards.js';

readAsyncInput({ stdin: process.stdin })
  .then(handleEvent)
  .catch(() => {
    // Hooks must never crash — an unhandled error here would surface as
    // a Claude Code failure. Silent exit is the correct fallback.
  });

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

function handleEvent(event: HookEvent): void {
  const sessionId = event.session_id ?? '';

  if (!sessionId) return;

  const cwd = event.cwd ?? process.cwd();
  const fs = { readFileSync };
  const tmpdirDeps = { tmpdir };

  // ── Read debounce state ───────────────────────────────────────
  const warnPath = debouncePath(sessionId, tmpdirDeps);
  const debounce = safeReadDebounce(warnPath, fs);

  // ── Context guard ─────────────────────────────────────────────
  const bridge = bridgePath(sessionId, tmpdirDeps);
  const metricsRaw = safeRead(bridge, fs);
  const metrics = metricsRaw ? parseBridgeMetrics(metricsRaw) : null;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const contextResult = runContextGuard(metrics, debounce.context, nowSeconds);

  // ── Time guard ────────────────────────────────────────────────
  const lock = readLockFile(cwd, fs);
  const timeLimit = resolveTimeLimit(process.env.CLANCY_TIME_LIMIT);

  const timeResult = runTimeGuard(
    {
      startedAt: lock?.startedAt,
      timeLimitMinutes: timeLimit,
      nowMs: Date.now(),
    },
    debounce.time,
  );

  // ── Persist + output ──────────────────────────────────────────
  const results = { context: contextResult, time: timeResult };
  persistDebounce(warnPath, debounce, results);
  emitWarnings(contextResult, timeResult);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ReadFn = { readonly readFileSync: (p: string, e: 'utf8') => string };

function safeRead(path: string, deps: ReadFn): string | null {
  try {
    return deps.readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function safeReadDebounce(path: string, deps: ReadFn): DebounceState {
  const raw = safeRead(path, deps);

  return raw ? parseDebounceState(raw) : EMPTY_DEBOUNCE;
}

type GuardResults = {
  readonly context: GuardResult;
  readonly time: GuardResult;
};

function persistDebounce(
  warnPath: string,
  debounce: DebounceState,
  results: GuardResults,
): void {
  const stateChanged =
    results.context.debounce !== debounce.context ||
    results.time.debounce !== debounce.time;

  if (!stateChanged) return;

  const updated = {
    context: results.context.debounce,
    time: results.time.debounce,
  };

  try {
    writeFileSync(warnPath, JSON.stringify(updated));
  } catch {
    /* best-effort */
  }
}

function emitWarnings(
  contextResult: GuardResult,
  timeResult: GuardResult,
): void {
  const messages = [contextResult.message, timeResult.message].filter(
    (m): m is string => m !== null,
  );

  if (messages.length === 0) return;

  const output = contextOutput('PostToolUse', messages.join('\n'));
  process.stdout.write(JSON.stringify(output));
}
