/**
 * Shared types used across all hook modules.
 *
 * Defines the shapes for Claude Code hook events, hook responses,
 * lock file data, and dependency injection surfaces.
 */

/** Raw event data passed by Claude Code to hooks. */
export type HookEvent = {
  readonly session_id?: string;
  readonly cwd?: string;
  readonly tool_name?: string;
  readonly tool_input?: Record<string, unknown>;
  readonly transcript_path?: string;
  readonly context_window?: {
    readonly remaining_percentage?: number;
  };
  readonly message?: string;
  readonly notification?: string;
};

/** PreToolUse decision output. */
export type PreToolUseResult = {
  readonly decision: 'approve' | 'block';
  readonly reason?: string;
};

/** PostToolUse / other hook output with additional context injection. */
export type HookContextOutput = {
  readonly hookSpecificOutput: {
    readonly hookEventName: string;
    readonly additionalContext: string;
  };
};

/** Lock file contents from `.clancy/lock.json`. */
export type LockData = {
  readonly pid?: number;
  readonly ticketKey?: string;
  readonly ticketTitle?: string;
  readonly ticketBranch?: string;
  readonly targetBranch?: string;
  readonly parentKey?: string;
  readonly startedAt?: string;
  readonly description?: string;
};

/** Filesystem abstraction for hook utilities that read files. */
export type HookFs = {
  readonly readFileSync: (path: string, encoding: 'utf8') => string;
};

/**
 * Check whether a value is a plain object (not null, not an array).
 *
 * Intentionally duplicated in `installer/shared/type-guards/` — hooks are
 * self-contained esbuild bundles and cannot share code with the installer.
 *
 * @param value - The value to check.
 * @returns `true` if the value is a non-null, non-array object.
 */
export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Tmpdir provider for path-building utilities. */
export type TmpdirDeps = {
  readonly tmpdir: () => string;
};
