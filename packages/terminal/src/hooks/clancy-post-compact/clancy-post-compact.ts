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

import { contextOutput } from '../shared/hook-output/index.js';
import { readLockFile } from '../shared/lock-file/index.js';
import { readAsyncInput } from '../shared/stdin-reader/index.js';
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
    /* best-effort: silent exit */
  });
