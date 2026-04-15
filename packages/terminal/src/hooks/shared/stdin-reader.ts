/**
 * Stdin reader utilities for Claude Code hooks.
 *
 * Claude Code passes event data to hooks in two ways:
 * - **PreToolUse** (blocking): JSON on `process.argv[2]`, fd 0 fallback
 * - **PostToolUse / others** (non-blocking): JSON streamed to stdin
 *
 * Both readers return `{}` on any failure — hooks are best-effort.
 */
import type { HookEvent } from './types.js';

import { text } from 'node:stream/consumers';

import { isPlainObject } from './types.js';

const EMPTY: HookEvent = {};
const DEFAULT_TIMEOUT_MS = 3000;

/**
 * File descriptor 0 (stdin) — cross-platform alternative to `/dev/stdin`.
 * Works on macOS, Linux, and Windows.
 */
const STDIN_FD = 0;

/** Dependencies for the synchronous PreToolUse reader. */
type StdinReaderDeps = {
  readonly argv: readonly string[];
  readonly readFileSync: (fd: number, encoding: 'utf8') => string;
};

/** Dependencies for the asynchronous stdin reader. */
type AsyncStdinDeps = {
  readonly stdin: NodeJS.ReadableStream;
  readonly timeoutMs?: number;
};

/** Safely parse a JSON string into a HookEvent, returning `{}` on failure. */
function safeParse(raw: string): HookEvent {
  try {
    const parsed: unknown = JSON.parse(raw);

    // Safe: all HookEvent fields are optional — any plain object is a valid shape
    return isPlainObject(parsed) ? (parsed as HookEvent) : EMPTY;
  } catch {
    return EMPTY;
  }
}

/**
 * Read PreToolUse input synchronously.
 *
 * Checks `argv[2]` first (Claude Code passes JSON as the third argument),
 * then falls back to reading fd 0 (stdin). Returns `{}` on any failure.
 *
 * @param deps - Argument vector and filesystem reader.
 * @returns Parsed hook event data.
 */
export function readPreToolUseInput(deps: StdinReaderDeps): HookEvent {
  const argvPayload = deps.argv[2];

  if (argvPayload) return safeParse(argvPayload);

  try {
    const raw = deps.readFileSync(STDIN_FD, 'utf8');

    return safeParse(raw);
  } catch {
    return EMPTY;
  }
}

/** Resolve to `EMPTY` after the given timeout. */
function timeoutPromise(ms: number): Promise<HookEvent> {
  return new Promise((resolve) => {
    // Timer is intentionally not cleared — hooks are short-lived processes
    setTimeout(() => resolve(EMPTY), ms);
  });
}

/**
 * Read hook input asynchronously from stdin.
 *
 * Consumes the full stream via `node:stream/consumers` and races against
 * a timeout guard (default 3 seconds). Returns `{}` on timeout or failure.
 *
 * @param deps - Readable stream and optional timeout.
 * @returns Promise resolving to parsed hook event data.
 */
export function readAsyncInput(deps: AsyncStdinDeps): Promise<HookEvent> {
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const consume = text(deps.stdin).then(safeParse);

  return Promise.race([consume, timeoutPromise(timeoutMs)]);
}
