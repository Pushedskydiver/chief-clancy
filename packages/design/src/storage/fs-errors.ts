/**
 * Shared fs-error narrowing for the storage modules.
 *
 * Every read-side storage module distinguishes "the file isn't there yet"
 * (a normal empty state) from a real I/O failure, which means narrowing
 * `unknown` to an errno-bearing error before reading `.code`. (Write-only
 * modules like `storage/approve.ts` have no such branch.) Extracted once
 * the third copy appeared.
 *
 * No longer read-side only: `storage/variants.ts` narrows on the write path
 * too, to tell an id collision (EEXIST, under an exclusive create) from any
 * other write failure.
 */
export const isNodeFsError = (err: unknown): err is NodeJS.ErrnoException =>
  typeof err === 'object' && err !== null && 'code' in err;
