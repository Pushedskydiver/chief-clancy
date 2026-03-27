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

import { readAsyncInput } from '../shared/stdin-reader/index.js';
import { bridgePath } from '../shared/tmpdir/index.js';
import {
  buildBridgeData,
  buildStatusline,
  checkUpdateAvailable,
  resolveCachePath,
} from './build-statusline.js';

readAsyncInput({ stdin: process.stdin })
  .then(handleEvent)
  .catch(() => {
    /* best-effort: silent exit */
  });

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

function handleEvent(event: HookEvent): void {
  const sessionId = event.session_id ?? '';
  const remaining = event.context_window?.remaining_percentage;

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
  const statusline = buildStatusline(updateAvailable, remaining);

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
