/**
 * SessionStart hook: check-update.
 *
 * Runs at session start to check for Clancy updates and detect stale
 * unapproved briefs. The npm version check runs synchronously with a
 * short timeout to avoid blocking session startup for too long.
 *
 * Best-effort: any failure exits silently.
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';

import {
  buildUpdateCache,
  countStaleBriefs,
  fetchLatestVersion,
  findInstallDir,
  readInstalledVersion,
  resolveCachePaths,
  staleCountPath,
} from './check-update.js';

try {
  const cwd = process.cwd();
  const home = homedir();

  // ── Stale brief detection (synchronous) ──────────────────────────
  handleStaleBriefs(cwd);

  // ── Find install dir ─────────────────────────────────────────────
  const installDir = findInstallDir(cwd, { readFileSync, homedir });

  if (installDir) {
    runUpdateCheck(installDir, home);
  }
} catch {
  // Hooks must never crash — an unhandled error here would surface as
  // a Claude Code failure. Silent exit is the correct fallback.
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function handleStaleBriefs(cwd: string): void {
  const countFile = staleCountPath(cwd);
  const count = countStaleBriefs(cwd, Date.now(), { readdirSync, existsSync });

  if (count === null) {
    // No briefs dir — clean up stale count file if present
    try {
      unlinkSync(countFile);
    } catch {
      /* file may not exist */
    }

    return;
  }

  try {
    writeFileSync(countFile, String(count));
  } catch {
    /* best-effort */
  }
}

function runUpdateCheck(installDir: string, home: string): void {
  const installed = readInstalledVersion(installDir, { readFileSync });
  const cache = resolveCachePaths(home);

  // Ensure cache directory exists
  try {
    mkdirSync(cache.dir, { recursive: true });
  } catch {
    /* dir may already exist */
  }

  const latest = fetchLatestVersion({ execFileSync });
  const nowSeconds = Math.floor(Date.now() / 1000);
  const data = buildUpdateCache(installed, latest, nowSeconds);

  try {
    writeFileSync(cache.file, JSON.stringify(data));
  } catch {
    /* best-effort — cache write failure is non-fatal */
  }
}
