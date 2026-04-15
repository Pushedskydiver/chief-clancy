/**
 * Notification hook.
 *
 * Sends native OS desktop notifications when triggered by Claude Code.
 * Dispatches to macOS (osascript), Linux (notify-send), or Windows
 * (PowerShell). Falls back to console.log on unsupported platforms
 * or command failures.
 *
 * Best-effort: any failure exits silently.
 */
import { execFileSync } from 'node:child_process';

import { readAsyncInput } from '../shared/stdin-reader/stdin-reader.js';
import { extractMessage, sendNotification } from './send-notification.js';

const DISABLED = process.env.CLANCY_DESKTOP_NOTIFY === 'false';

if (DISABLED) {
  process.exit(0);
}

readAsyncInput({ stdin: process.stdin })
  .then((event) => {
    const message = extractMessage(event);

    sendNotification(message, {
      platform: process.platform,
      exec: execFileSync,
      log: console.log,
    });
  })
  .catch(() => {
    // Hooks must never crash — an unhandled error here would surface as
    // a Claude Code failure. Silent exit is the correct fallback.
  });
