/**
 * Shared fs-error narrowing for the storage modules.
 *
 * Every read-side storage module distinguishes "the file isn't there yet"
 * (a normal empty state) from a real I/O failure, which means narrowing
 * `unknown` to an errno-bearing error before reading `.code`. Extracted once
 * the third copy appeared; since `storage/approve.ts` gained a read side at
 * A5 there are no write-only storage modules left, so every one of them
 * imports this.
 *
 * No longer read-side only: `storage/variants.ts` narrows on the write path
 * too, to tell an id collision (EEXIST, under an exclusive create) from any
 * other write failure.
 */
export const isNodeFsError = (err: unknown): err is NodeJS.ErrnoException =>
  typeof err === 'object' && err !== null && 'code' in err;
