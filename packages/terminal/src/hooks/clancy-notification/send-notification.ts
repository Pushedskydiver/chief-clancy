/**
 * Notification dispatch logic.
 *
 * Extracts the notification message from various event payload shapes
 * and dispatches it via platform-native desktop notifications.
 * Falls back to console.log when the platform is unsupported or the
 * notification command fails.
 */
import type { HookEvent } from '../shared/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Platform identifier for notification dispatch. */
type Platform = 'darwin' | 'linux' | 'win32';

/** Synchronous command executor (injected for testability). */
type ExecFn = (
  cmd: string,
  args: readonly string[],
  opts: { readonly timeout: number; readonly windowsHide: boolean },
) => void;

/** Dependencies for sending a notification. */
type NotifyDeps = {
  readonly platform: string;
  readonly exec: ExecFn;
  readonly log: (msg: string) => void;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MESSAGE = 'Clancy notification';
const EXEC_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// Message extraction
// ---------------------------------------------------------------------------

/**
 * Extract the notification message from the event payload.
 *
 * Checks multiple possible shapes — `message`, `notification`, and
 * `text` — falling back to a default.
 *
 * @param event - Raw hook event data.
 * @returns The notification message string.
 */
export function extractMessage(event: HookEvent): string {
  if (typeof event.message === 'string' && event.message !== '') {
    return event.message;
  }

  if (typeof event.notification === 'string' && event.notification !== '') {
    return event.notification;
  }

  const text = (event as Record<string, unknown>).text;

  if (typeof text === 'string' && text !== '') return text;

  return DEFAULT_MESSAGE;
}

// ---------------------------------------------------------------------------
// Platform notifiers
// ---------------------------------------------------------------------------

/**
 * Escape a string for use inside AppleScript single quotes.
 *
 * @param s - The raw string.
 * @returns Escaped string safe for `osascript -e`.
 */
export function escapeAppleScript(s: string): string {
  return s.replaceAll("'", "'\"'\"'");
}

/**
 * Escape a string for use inside PowerShell double quotes.
 *
 * @param s - The raw string.
 * @returns Escaped string safe for PowerShell `-Command`.
 */
export function escapePowerShell(s: string): string {
  return s.replaceAll('`', '``').replaceAll('$', '`$').replaceAll('"', '`"');
}

/**
 * Send a desktop notification on macOS via `osascript`.
 *
 * @param message - The notification text.
 * @param exec - Command executor.
 */
function notifyDarwin(message: string, exec: ExecFn): void {
  const escaped = escapeAppleScript(message);
  const script = `display notification '${escaped}' with title "Clancy"`;

  exec('osascript', ['-e', script], {
    timeout: EXEC_TIMEOUT_MS,
    windowsHide: true,
  });
}

/**
 * Send a desktop notification on Linux via `notify-send`.
 *
 * @param message - The notification text.
 * @param exec - Command executor.
 */
function notifyLinux(message: string, exec: ExecFn): void {
  exec('notify-send', ['Clancy', message], {
    timeout: EXEC_TIMEOUT_MS,
    windowsHide: true,
  });
}

/**
 * Send a desktop notification on Windows via PowerShell.
 *
 * Uses `MessageBox::Show` which opens a modal dialog. This is blocking
 * but runs in a separate hook process so it does not block Claude.
 * True toast notifications (`BurntToast`, `Windows.UI.Notifications`)
 * require third-party modules or complex WinRT bindings not available
 * by default.
 *
 * @param message - The notification text.
 * @param exec - Command executor.
 */
function notifyWindows(message: string, exec: ExecFn): void {
  const escaped = escapePowerShell(message);
  const cmd =
    'Add-Type -AssemblyName System.Windows.Forms; ' +
    `[System.Windows.Forms.MessageBox]::Show("${escaped}", "Clancy")`;

  exec('powershell', ['-Command', cmd], {
    timeout: EXEC_TIMEOUT_MS,
    windowsHide: true,
  });
}

/** Map of platform to notifier function. */
const NOTIFIERS: Readonly<Record<Platform, typeof notifyDarwin>> = {
  darwin: notifyDarwin,
  linux: notifyLinux,
  win32: notifyWindows,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a desktop notification for the given message.
 *
 * Dispatches to the appropriate platform notifier. Falls back to
 * `console.log` if the platform is unsupported or the command fails.
 *
 * @param message - The notification text.
 * @param deps - Platform, executor, and logger (injected).
 */
export function sendNotification(message: string, deps: NotifyDeps): void {
  const notifier = NOTIFIERS[deps.platform as Platform];

  if (!notifier) {
    deps.log(message);

    return;
  }

  try {
    notifier(message, deps.exec);
  } catch {
    deps.log(message);
  }
}
