/**
 * Shared Jira basic auth helper for E2E tests.
 *
 * Mirrors the runtime buildAuthHeader in the Jira board module.
 */

/**
 * Build a Base64-encoded Basic auth string for Jira API requests.
 *
 * @param user - The Jira username (email).
 * @param apiToken - The Jira API token.
 * @returns Base64-encoded auth string.
 */
export function buildJiraAuth(user: string, apiToken: string): string {
  return Buffer.from(`${user}:${apiToken}`).toString('base64');
}
