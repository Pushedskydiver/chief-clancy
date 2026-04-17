/**
 * ANSI escape code helpers for terminal output.
 *
 * Wraps strings in ANSI sequences for styling in CLI environments.
 * These helpers do not compose — nesting calls (e.g. `bold(red('x'))`)
 * produces concatenated codes where the inner reset cancels outer styles.
 */

export const dim = (s: string): string => `\x1b[2m${s}\x1b[0m`;

export const bold = (s: string): string => `\x1b[1m${s}\x1b[0m`;

/** Bold+blue (`1;34`) for contrast on dark backgrounds. */
export const blue = (s: string): string => `\x1b[1;34m${s}\x1b[0m`;

export const cyan = (s: string): string => `\x1b[36m${s}\x1b[0m`;

export const green = (s: string): string => `\x1b[32m${s}\x1b[0m`;

export const red = (s: string): string => `\x1b[31m${s}\x1b[0m`;

export const yellow = (s: string): string => `\x1b[33m${s}\x1b[0m`;
