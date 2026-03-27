import type { Fetcher } from '~/c/shared/http/index.js';

/**
 * Azure DevOps pure helper functions.
 *
 * Auth, headers, WIQL validation, URL builders, tag parsing, and key parsing.
 * All pure functions — no I/O.
 */

/** Azure DevOps API version used on all requests. */
export const AZDO_API_VERSION = '7.1';

/** Azure DevOps connection context (org + project + PAT). */
export type AzdoCtx = {
  readonly org: string;
  readonly project: string;
  readonly pat: string;
  readonly fetcher?: Fetcher;
};

// ─── Auth ────────────────────────────────────────────────────────────────────

/**
 * Build the Azure DevOps Basic auth header value.
 *
 * Azure DevOps uses `Basic base64(':' + pat)` — empty username, colon, then PAT.
 *
 * @param pat - The personal access token.
 * @returns The `Basic ...` header value.
 */
export function buildAzdoAuth(pat: string): string {
  return `Basic ${btoa(`:${pat}`)}`;
}

/**
 * Build standard headers for Azure DevOps requests.
 *
 * @param pat - The personal access token.
 * @returns Headers object for Azure DevOps API requests.
 */
export function azdoHeaders(pat: string): Record<string, string> {
  return {
    Authorization: buildAzdoAuth(pat),
    'Content-Type': 'application/json',
  };
}

/**
 * Build JSON Patch headers (required for work item updates).
 *
 * @param pat - The personal access token.
 * @returns Headers object with `application/json-patch+json` content type.
 */
export function azdoPatchHeaders(pat: string): Record<string, string> {
  return {
    Authorization: buildAzdoAuth(pat),
    'Content-Type': 'application/json-patch+json',
  };
}

// ─── WIQL injection prevention ───────────────────────────────────────────────

/**
 * Validate that a value is safe to interpolate into a WIQL query.
 *
 * Blocks single quotes (WIQL string delimiter), backslashes, `--`
 * (SQL comment), `;` (statement separator), block comments, newlines,
 * and non-printable characters.
 *
 * @param value - The string to validate.
 * @returns `true` if the value is safe for WIQL interpolation.
 */
export function isSafeWiqlValue(value: string): boolean {
  if (value.includes("'")) return false;
  if (value.includes('\\')) return false;
  if (value.includes('--')) return false;
  if (value.includes(';')) return false;
  if (value.includes('/*')) return false;
  if (/[^\x20-\x7E\t]/.test(value)) return false;
  return true;
}

// ─── URL builders ────────────────────────────────────────────────────────────

/**
 * Build the Azure DevOps API base URL for a given org and project.
 *
 * @param org - The Azure DevOps organisation name.
 * @param project - The Azure DevOps project name.
 * @returns The API base URL.
 */
export function apiBase(org: string, project: string): string {
  return `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis`;
}

// ─── Tag helpers ─────────────────────────────────────────────────────────────

/**
 * Parse Azure DevOps semicolon-separated tags into an array.
 *
 * @param tags - The raw tags string (e.g., `"tag1; tag2; tag3"`).
 * @returns Array of trimmed tag strings.
 */
export function parseTags(tags: string | null | undefined): readonly string[] {
  if (!tags) return [];
  return tags
    .split(';')
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Rebuild a tags string from an array.
 *
 * @param tags - Array of tag strings.
 * @returns Semicolon-separated tags string.
 */
export function buildTagsString(tags: readonly string[]): string {
  return tags.join('; ');
}

// ─── Relation URL parsing ────────────────────────────────────────────────────

/**
 * Extract the work item ID from a relation URL.
 *
 * Relation URLs look like: `https://dev.azure.com/{org}/_apis/wit/workItems/{id}`
 *
 * @param url - The relation URL.
 * @returns The work item ID, or `undefined` if parsing fails.
 */
export function extractIdFromRelationUrl(url: string): number | undefined {
  const match = url.match(/workItems\/(\d+)/i);
  if (!match) return undefined;
  const num = parseInt(match[1], 10);
  return Number.isNaN(num) ? undefined : num;
}

// ─── Key validation ──────────────────────────────────────────────────────────

/**
 * Parse a work item ID from an Azure DevOps key (e.g., `'azdo-123'` → `123`).
 *
 * @param key - The Azure DevOps work item key.
 * @returns The numeric work item ID, or `undefined` if parsing fails.
 */
export function parseWorkItemId(key: string): number | undefined {
  const num = parseInt(key.replace('azdo-', ''), 10);
  return Number.isNaN(num) ? undefined : num;
}
