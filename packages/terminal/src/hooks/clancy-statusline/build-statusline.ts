/**
 * Statusline builder logic.
 *
 * Pure functions for normalising context usage, building the ANSI
 * context bar, composing the statusline string, and preparing
 * bridge file data. All I/O is handled by the entry point.
 */
import type { HookFs } from '../shared/types.js';

import { join } from 'node:path';

import { isPlainObject } from '../shared/types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Claude Code reserves ~16.5% of the context window for its
 * auto-compact buffer. Normalise usage so 100% represents the
 * usable limit (consistent with GSD display).
 */
const AUTO_COMPACT_BUFFER_PCT = 16.5;

const BAR_WIDTH = 10;
const FILLED_CHAR = '\u2588'; // █
const EMPTY_CHAR = '\u2591'; // ░

// ANSI escape codes
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const ORANGE = '\x1b[38;5;208m';
const BLINK_RED = '\x1b[5;31m';

const SEPARATOR = ' \u2502 '; // │

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Normalised context usage after accounting for auto-compact buffer. */
type NormalizedUsage = {
  readonly usableRemaining: number;
  readonly usedPct: number;
};

/** Bridge file data written for the context monitor. */
type BridgeData = {
  readonly session_id: string;
  readonly remaining_percentage: number;
  readonly used_pct: number;
  readonly timestamp: number;
};

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/**
 * Normalise raw remaining percentage to account for the auto-compact buffer.
 *
 * Claude Code reserves ~16.5% of context for auto-compaction. This
 * rescales the remaining percentage so 0% means "auto-compact imminent"
 * and 100% means "full usable window available".
 *
 * @param remaining - Raw remaining percentage from Claude Code (0–100).
 * @returns Normalised usable remaining and used percentages.
 */
export function normalizeContextUsage(remaining: number): NormalizedUsage {
  const usableRemaining = Math.max(
    0,
    ((remaining - AUTO_COMPACT_BUFFER_PCT) / (100 - AUTO_COMPACT_BUFFER_PCT)) *
      100,
  );
  const usedPct = Math.max(0, Math.min(100, Math.round(100 - usableRemaining)));

  return { usableRemaining, usedPct };
}

// ---------------------------------------------------------------------------
// Bridge data
// ---------------------------------------------------------------------------

/**
 * Build the bridge file payload for the context monitor.
 *
 * @param session - Session ID.
 * @param remaining - Raw remaining percentage.
 * @param nowSeconds - Current time in Unix seconds.
 * @returns Bridge data object ready for JSON serialisation.
 */
export function buildBridgeData(
  session: string,
  remaining: number,
  nowSeconds: number,
): BridgeData {
  const { usedPct } = normalizeContextUsage(remaining);

  return {
    session_id: session,
    remaining_percentage: remaining,
    used_pct: usedPct,
    timestamp: nowSeconds,
  };
}

// ---------------------------------------------------------------------------
// Context bar
// ---------------------------------------------------------------------------

/**
 * Build an ANSI-coloured context usage bar.
 *
 * Colour thresholds:
 * - Green: < 50%
 * - Yellow: 50–64%
 * - Orange: 65–79%
 * - Blinking red with skull: >= 80%
 *
 * @param usedPct - Normalised used percentage (0–100).
 * @returns ANSI-escaped bar string.
 */
export function buildContextBar(usedPct: number): string {
  const filled = Math.max(
    0,
    Math.min(BAR_WIDTH, Math.floor(usedPct / BAR_WIDTH)),
  );
  const bar =
    FILLED_CHAR.repeat(filled) + EMPTY_CHAR.repeat(BAR_WIDTH - filled);

  const isLow = usedPct < 50;
  const isMedium = usedPct >= 50 && usedPct < 65;
  const isHigh = usedPct >= 65 && usedPct < 80;

  if (isLow) return `${GREEN}${bar} ${usedPct}%${RESET}`;
  if (isMedium) return `${YELLOW}${bar} ${usedPct}%${RESET}`;
  if (isHigh) return `${ORANGE}${bar} ${usedPct}%${RESET}`;

  return `${BLINK_RED}\u{1F480} ${bar} ${usedPct}%${RESET}`;
}

// ---------------------------------------------------------------------------
// Update badge
// ---------------------------------------------------------------------------

/**
 * Check whether an update is available from the cached check result.
 *
 * @param cachePath - Path to the update check cache JSON file.
 * @param deps - Filesystem reader.
 * @returns `true` if an update is available.
 */
export function checkUpdateAvailable(cachePath: string, deps: HookFs): boolean {
  try {
    const raw: unknown = JSON.parse(deps.readFileSync(cachePath, 'utf8'));

    if (!isPlainObject(raw)) return false;

    return raw.update_available === true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Cache path
// ---------------------------------------------------------------------------

/** Dependencies for resolving the update cache path. */
type CachePathDeps = {
  readonly env: string | undefined;
  readonly homedir: () => string;
};

/**
 * Resolve the path to the update check cache file.
 *
 * Checks `CLAUDE_CONFIG_DIR` env first, falls back to `~/.claude`.
 *
 * @param deps - Environment variable and homedir provider.
 * @returns Absolute path to the cache JSON file.
 */
export function resolveCachePath(deps: CachePathDeps): string {
  const claudeDir = deps.env ?? join(deps.homedir(), '.claude');

  return join(claudeDir, 'cache', 'clancy-update-check.json');
}

// ---------------------------------------------------------------------------
// Statusline composer
// ---------------------------------------------------------------------------

/**
 * Read the installed Clancy version from the VERSION file.
 *
 * Checks the local project first, then falls back to the global
 * home directory. Returns `undefined` if not found.
 *
 * @param cwd - Current working directory.
 * @param home - User home directory.
 * @param deps - Filesystem reader.
 * @returns Version string, or `undefined`.
 */
export function readInstalledVersion(
  cwd: string,
  home: string,
  deps: HookFs,
): string | undefined {
  const localPath = join(cwd, '.claude', 'commands', 'clancy', 'VERSION');
  const globalPath = join(home, '.claude', 'commands', 'clancy', 'VERSION');

  return safeReadTrim(localPath, deps) ?? safeReadTrim(globalPath, deps);
}

function safeReadTrim(path: string, deps: HookFs): string | undefined {
  try {
    const value = deps.readFileSync(path, 'utf8').trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Compose the full statusline string from its parts.
 *
 * @param updateAvailable - Whether to show the update badge.
 * @param remaining - Raw remaining percentage, or `undefined` if unavailable.
 * @param version - Installed version string, or `undefined`.
 * @returns The final statusline string for stdout.
 */
export function buildStatusline(
  updateAvailable: boolean,
  remaining: number | undefined,
  version?: string,
): string {
  const updateBadge = updateAvailable
    ? `${YELLOW}\u2B06 /clancy:update${RESET}`
    : undefined;

  const versionSuffix = version ? ` ${DIM}v${version}${RESET}` : '';
  const hasContext = remaining !== undefined;
  const clancyLabel = hasContext
    ? `${DIM}Clancy${RESET}${versionSuffix} ${buildContextBar(normalizeContextUsage(remaining).usedPct)}`
    : `${DIM}Clancy${RESET}${versionSuffix}`;

  return [updateBadge, clancyLabel].filter(Boolean).join(SEPARATOR);
}
