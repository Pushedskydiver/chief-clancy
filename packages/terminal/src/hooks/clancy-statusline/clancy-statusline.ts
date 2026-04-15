/**
 * Statusline hook.
 *
 * Registered as the Claude Code statusline. Two jobs:
 * 1. Write context metrics to a bridge file so the PostToolUse context
 *    monitor can read them (the statusline is the only hook that
 *    receives context_window data directly).
 * 2. Output a statusline string showing context usage and update status.
 *
 * Best-effort: any failure exits silently.
 */
import type { HookEvent } from '../shared/types.js';

import { readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { cwd } from 'node:process';

import { readAsyncInput } from '../shared/stdin-reader.js';
import { bridgePath } from '../shared/tmpdir.js';
import {
  buildBridgeData,
  buildStatusline,
  checkUpdateAvailable,
  readInstalledVersion,
  resolveCachePath,
} from './build-statusline.js';

readAsyncInput({ stdin: process.stdin })
  .then(handleEvent)
  .catch(() => {
    // Hooks must never crash — an unhandled error here would surface as
    // a Claude Code failure. Silent exit is the correct fallback.
  });

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

function handleEvent(event: HookEvent): void {
  const sessionId = event.session_id ?? '';
  const rawRemaining = event.context_window?.remaining_percentage;

  // Claude Code sends remaining_percentage: 0 on the first statusline call
  // before context data is available. Treat 0 as "no data" — auto-compact
  // fires at ~16.5%, so 0 is never reachable in practice.
  const remaining = rawRemaining === 0 ? undefined : rawRemaining;

  // ── Bridge file ─────────────────────────────────────────────────
  const hasBridgeData = sessionId !== '' && remaining !== undefined;

  if (hasBridgeData) {
    writeBridge(sessionId, remaining);
  }

  // ── Statusline output ───────────────────────────────────────────
  const cachePath = resolveCachePath({
    env: process.env.CLAUDE_CONFIG_DIR,
    homedir,
  });
  const updateAvailable = checkUpdateAvailable(cachePath, { readFileSync });
  const version = readInstalledVersion(cwd(), homedir(), { readFileSync });
  const statusline = buildStatusline(updateAvailable, remaining, version);

  process.stdout.write(statusline);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeBridge(sessionId: string, remaining: number): void {
  try {
    const bridge = bridgePath(sessionId, { tmpdir });
    const data = buildBridgeData(
      sessionId,
      remaining,
      Math.floor(Date.now() / 1000),
    );

    writeFileSync(bridge, JSON.stringify(data));
  } catch {
    /* bridge is best-effort */
  }
}
