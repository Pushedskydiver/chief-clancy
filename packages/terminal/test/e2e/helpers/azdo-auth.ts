/**
 * Shared Azure DevOps auth helpers for E2E tests.
 *
 * Returns the Base64-encoded payload only (no "Basic " prefix).
 * Callers pass the result to azdoHeaders/azdoPatchHeaders which add the prefix.
 */

/**
 * Build the Base64-encoded `:<PAT>` payload for Azure DevOps Basic auth.
 *
 * @param pat - The Azure DevOps Personal Access Token.
 * @returns Base64-encoded auth payload.
 */
export function buildAzdoAuth(pat: string): string {
  return Buffer.from(`:${pat}`).toString('base64');
}

/**
 * Standard JSON headers for Azure DevOps API requests.
 *
 * @param auth - Base64-encoded auth payload from buildAzdoAuth.
 * @returns Headers object.
 */
export function azdoHeaders(auth: string): Record<string, string> {
  return {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  };
}

/**
 * JSON Patch headers for Azure DevOps work item updates.
 *
 * @param auth - Base64-encoded auth payload from buildAzdoAuth.
 * @returns Headers object.
 */
export function azdoPatchHeaders(auth: string): Record<string, string> {
  return {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json-patch+json',
  };
}

/**
 * Build the Azure DevOps API base URL.
 *
 * @param org - The Azure DevOps organisation name.
 * @param project - The Azure DevOps project name.
 * @returns The API base URL.
 */
export function azdoBaseUrl(org: string, project: string): string {
  return `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis`;
}
