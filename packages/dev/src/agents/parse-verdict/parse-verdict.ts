/**
 * Verdict parser — extract a fenced JSON block from Claude output
 * and validate it against the ReadinessVerdict schema.
 */
import type { ReadinessVerdict } from '../types/types.js';

import { readinessVerdictSchema } from '../types/types.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type ParseSuccess = {
  readonly ok: true;
  readonly verdict: ReadinessVerdict;
};

type ParseFailure = {
  readonly ok: false;
  readonly error: string;
};

type ParseResult = ParseSuccess | ParseFailure;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Extract content from the first ```json fence. O(n) with no backtracking. */
function extractFencedJson(text: string): string | undefined {
  const openTag = '```json';
  const closeTag = '```';

  const openIdx = text.indexOf(openTag);
  if (openIdx === -1) return undefined;

  const contentStart = text.indexOf('\n', openIdx + openTag.length);
  if (contentStart === -1) return undefined;

  const closeIdx = text.indexOf(closeTag, contentStart + 1);
  if (closeIdx === -1) return undefined;

  return text.slice(contentStart + 1, closeIdx);
}

// ─── Parser ─────────────────────────────────────────────────────────────────

/**
 * Extract and validate a ReadinessVerdict from Claude's text output.
 *
 * Looks for the first ` ```json ` fenced block, parses it as JSON,
 * then validates against the zod/mini schema.
 *
 * @param text - Raw Claude output (may contain prose around the fence).
 * @returns A discriminated union: `{ ok: true, verdict }` or `{ ok: false, error }`.
 */
export function safeParseVerdict(text: string): ParseResult {
  const jsonContent = extractFencedJson(text);

  if (jsonContent === undefined) {
    return { ok: false, error: 'No fenced JSON block found in output' };
  }

  const parsed = (() => {
    try {
      return { ok: true as const, data: JSON.parse(jsonContent) as unknown };
    } catch {
      return { ok: false as const };
    }
  })();

  if (!parsed.ok) {
    return { ok: false, error: 'Invalid JSON in fenced block' };
  }

  const result = readinessVerdictSchema.safeParse(parsed.data);

  if (!result.success) {
    return {
      ok: false,
      error: `Schema validation failed: ${result.error.message}`,
    };
  }

  return { ok: true, verdict: result.data };
}
