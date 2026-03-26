/**
 * Webhook notification sender for Slack and Microsoft Teams.
 *
 * Sends completion notifications after a ticket is processed.
 * Best-effort — never throws on failure.
 */

/**
 * Detect whether a webhook URL is for Slack (vs Teams/other).
 *
 * Parses the URL and checks the hostname to avoid substring false
 * positives (e.g., `evil.com/?hooks.slack.com`).
 *
 * @param url - The webhook URL to check.
 * @returns `true` if the hostname ends with `hooks.slack.com`.
 */
export function isSlackWebhook(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === 'hooks.slack.com' || hostname.endsWith('.hooks.slack.com')
    );
  } catch {
    return false;
  }
}

/**
 * Build a Slack webhook payload.
 *
 * @param message - The notification message text.
 * @returns The JSON payload string for a Slack incoming webhook.
 */
export function buildSlackPayload(message: string): string {
  return JSON.stringify({ text: message });
}

/**
 * Build a Microsoft Teams webhook payload using an adaptive card.
 *
 * @param message - The notification message text.
 * @returns The JSON payload string for a Teams incoming webhook.
 */
export function buildTeamsPayload(message: string): string {
  return JSON.stringify({
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'TextBlock',
              text: message,
              wrap: true,
            },
          ],
        },
      },
    ],
  });
}

/** Options for sending a webhook notification. */
type NotifyOptions = {
  readonly webhookUrl: string;
  readonly message: string;
  readonly fetch: (url: string, init: RequestInit) => Promise<Response>;
  readonly warn?: (message: string) => void;
};

/**
 * Send a notification to a webhook URL.
 *
 * Automatically detects Slack vs Teams format based on the URL.
 * Best-effort — logs a warning on failure but never throws.
 *
 * @param options - The notification options with injected fetch.
 * @returns Resolves when the notification attempt completes (never rejects).
 */
export async function sendNotification(options: NotifyOptions): Promise<void> {
  const { webhookUrl, message, fetch: fetchFn, warn = console.warn } = options;
  const payload = isSlackWebhook(webhookUrl)
    ? buildSlackPayload(message)
    : buildTeamsPayload(message);

  try {
    const response = await fetchFn(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });

    if (!response.ok) {
      warn(`⚠ Notification failed: HTTP ${response.status}`);
    }
  } catch {
    warn('⚠ Notification failed: could not reach webhook');
  }
}
