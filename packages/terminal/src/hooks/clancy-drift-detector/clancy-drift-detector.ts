/**
 * PostToolUse hook: drift detector.
 *
 * Compares installed runtime version against the package VERSION file.
 * Warns once per session if they differ, prompting the user to run
 * `/clancy:update`. Uses a tmpdir flag for session debounce.
 *
 * Best-effort: any failure exits silently.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';

import { contextOutput } from '../shared/hook-output.js';
import { readAsyncInput } from '../shared/stdin-reader.js';
import { driftFlagPath } from '../shared/tmpdir.js';
import {
  buildDriftWarning,
  readInstalledVersion,
  readPackageVersion,
  versionsDiffer,
} from './detect-drift.js';

readAsyncInput({ stdin: process.stdin })
  .then((event) => {
    const sessionId = event.session_id ?? '';

    if (!sessionId) return;

    const flagPath = driftFlagPath(sessionId, { tmpdir });

    try {
      // Exclusive create (wx) — atomic debounce, no TOCTOU race
      writeFileSync(flagPath, '1', { flag: 'wx' });
    } catch {
      // File already exists (EEXIST) or write failed — already checked
      return;
    }

    const cwd = event.cwd ?? process.cwd();
    const fs = { readFileSync };
    const installed = readInstalledVersion(cwd, fs);
    const packaged = readPackageVersion(cwd, homedir(), fs);

    if (!installed || !packaged) return;

    const hasDrift = versionsDiffer(installed, packaged);

    if (!hasDrift) return;

    const warning = buildDriftWarning(installed, packaged);
    const output = contextOutput('PostToolUse', warning);
    process.stdout.write(JSON.stringify(output));
  })
  .catch(() => {
    // Hooks must never crash — an unhandled error here would surface as
    // a Claude Code failure. Silent exit is the correct fallback.
  });
