/**
 * Check whether a value is a plain object (not array, not null).
 *
 * Intentionally duplicated in `hooks/shared/types` — hooks are
 * self-contained esbuild bundles and cannot share code with the installer.
 */
export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
