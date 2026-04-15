/**
 * PostCompact hook: context restoration.
 *
 * After Claude's context window is compacted, re-injects the current
 * ticket context (key, branch, parent, description) from the lock file
 * so the agent continues without starting over.
 *
 * Best-effort: any failure exits silently.
 */
import { readFileSync } from 'node:fs';

import { contextOutput } from '../shared/hook-output.js';
import { readLockFile } from '../shared/lock-file.js';
import { readAsyncInput } from '../shared/stdin-reader.js';
import { buildCompactContext } from './build-context.js';

readAsyncInput({ stdin: process.stdin })
  .then((event) => {
    const cwd = event.cwd ?? process.cwd();
    const lock = readLockFile(cwd, { readFileSync });

    if (!lock) return;

    const context = buildCompactContext(lock);

    if (!context) return;

    const output = contextOutput('PostCompact', context);
    process.stdout.write(JSON.stringify(output));
  })
  .catch(() => {
    // Hooks must never crash — an unhandled error here would surface as
    // a Claude Code failure. Silent exit is the correct fallback.
  });
