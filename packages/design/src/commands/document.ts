/**
 * `clancy:design document` runtime handler — Phase F slice 8.
 *
 * Thin CLI-affordance layer over the slice 7 library function
 * `packages/design/src/write/document.ts`. Adds:
 *
 * - Progress logging (per-file write confirmations).
 * - Exit-code semantics (0 on success; non-zero on error — Phase F slice 8
 *   surfaces only the success path; error paths are owned by the bin
 *   wrapper at `packages/design/bin/design.js`, which catches and prints).
 *
 * Logging is dependency-injected via the `logger` option so unit tests can
 * capture output without spying on `console.log`. The default logger writes
 * to `process.stdout.write` (with a trailing newline) so bin invocation
 * gets the expected user-facing output without extra glue.
 *
 * Slice 7's `document()` is imported via `../write/document.js` and called
 * exactly once — slice 8 is intentionally a thin wrapper, not a place to
 * reimplement composition logic.
 */
import { relative } from 'node:path';

import { document } from '../write/document.js';

type Logger = (line: string) => void;

type RunDocumentOptions = {
  readonly logger?: Logger;
};

type RunDocumentResult = {
  readonly exitCode: number;
  readonly designJsonPath: string;
  readonly designMdPath: string;
};

const defaultLogger: Logger = (line) => {
  process.stdout.write(line + '\n');
};

export async function runDocument(
  projectRoot: string,
  options: RunDocumentOptions = {},
): Promise<RunDocumentResult> {
  const log = options.logger ?? defaultLogger;

  log('Running clancy:design document...');
  const { designJsonPath, designMdPath } = await document(projectRoot);

  // `relative()` handles trailing separators, normalisation, and
  // prefix-collision (e.g. `/foo/myapp` vs `/foo/myapp2`) correctly —
  // `startsWith` + slice would produce corrupted output for the collision
  // case (DA M2 fold).
  log(`Wrote ${relative(projectRoot, designJsonPath)}`);
  log(`Wrote ${relative(projectRoot, designMdPath)}`);

  return {
    exitCode: 0,
    designJsonPath,
    designMdPath,
  };
}
