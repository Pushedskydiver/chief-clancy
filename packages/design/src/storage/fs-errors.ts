/**
 * Shared fs-error narrowing for the storage modules.
 *
 * Distinguishing "the file isn't there yet" (a normal empty state) from a real
 * I/O failure means narrowing `unknown` to an errno-bearing error before
 * reading `.code`. Extracted once the third copy appeared; every storage module
 * that touches the filesystem now imports it, on the read path and — for an
 * exclusive create's EEXIST — the write path too.
 */
export const isNodeFsError = (err: unknown): err is NodeJS.ErrnoException =>
  typeof err === 'object' && err !== null && 'code' in err;
