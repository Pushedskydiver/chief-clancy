/**
 * Shared fs-error narrowing for the storage modules.
 *
 * Every storage module distinguishes "the file isn't there yet" (a normal
 * empty state) from a real I/O failure, which means narrowing `unknown`
 * to an errno-bearing error before reading `.code`. Extracted once the
 * third copy appeared.
 */
export const isNodeFsError = (err: unknown): err is NodeJS.ErrnoException =>
  typeof err === 'object' && err !== null && 'code' in err;
