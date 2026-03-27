/**
 * SessionStart hook: check-update.
 *
 * Runs at session start to check for Clancy updates and detect stale
 * unapproved briefs. The npm version check is spawned as a detached
 * background process to avoid blocking session startup.
 *
 * Best-effort: any failure exits silently.
 */
import { spawn } from 'node:child_process';
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
  countStaleBriefs,
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
  const installDir = findInstallDir(cwd, { existsSync, homedir });

  if (!installDir) process.exit(0);

  // ── Spawn detached update check ──────────────────────────────────
  spawnUpdateCheck(installDir, home);
} catch {
  /* best-effort: silent exit */
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

function spawnUpdateCheck(installDir: string, home: string): void {
  const installed = readInstalledVersion(installDir, { readFileSync });
  const cache = resolveCachePaths(home);

  // Ensure cache directory exists
  try {
    mkdirSync(cache.dir, { recursive: true });
  } catch {
    /* dir may already exist */
  }

  // Spawn detached child so parent can exit immediately
  const child = spawn(
    process.execPath,
    ['-e', buildChildScript(installed, cache.file)],
    { detached: true, stdio: 'ignore', windowsHide: true },
  );

  child.unref();
}

function buildChildScript(installed: string, cacheFile: string): string {
  // The child process runs npm and writes the cache file.
  // This duplicates the logic from buildUpdateCache/fetchLatestVersion
  // because detached processes need self-contained code. Keep in sync
  // with check-update.ts if the cache shape or comparison logic changes.
  // All values are JSON-encoded to prevent injection.
  const installedJson = JSON.stringify(installed);
  const cacheFileJson = JSON.stringify(cacheFile);

  return [
    `const { execFileSync } = require('child_process');`,
    `const fs = require('fs');`,
    `let latest = 'unknown';`,
    `try {`,
    `  latest = execFileSync('npm', ['view', 'chief-clancy', 'version'], { timeout: 10000, encoding: 'utf8' }).trim();`,
    `} catch {}`,
    `const installed = ${installedJson};`,
    `const hasLatest = latest !== 'unknown' && latest !== '';`,
    `const cache = {`,
    `  update_available: hasLatest && latest !== installed,`,
    `  installed,`,
    `  latest,`,
    `  checked: Math.floor(Date.now() / 1000),`,
    `};`,
    `try { fs.writeFileSync(${cacheFileJson}, JSON.stringify(cache)); } catch {}`,
  ].join('\n');
}
