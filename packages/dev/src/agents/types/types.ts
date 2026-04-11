/**
 * Readiness gate types — zod/mini schemas + inferred TypeScript types.
 *
 * The `ReadinessCheckId` union is the source of truth for check ids.
 * The schema-pair test (`schema-pair.test.ts`) asserts that
 * these ids match the `## Checks` headings in `readiness.md`.
 */
import { z } from 'zod/mini';

// ─── Check ids ──────────────────────────────────────────────────────────────

/** The 5 readiness check identifiers. */
const READINESS_CHECK_IDS = [
  'clear',
  'testable',
  'small',
  'locatable',
  'touch-bounded',
] as const;

const readinessCheckIdSchema = z.enum(READINESS_CHECK_IDS);

/** A readiness check identifier. */
export type ReadinessCheckId = z.infer<typeof readinessCheckIdSchema>;

// ─── Colours ────────────────────────────────────────────────────────────────

const checkColourSchema = z.enum(['green', 'yellow', 'red']);

/** Traffic-light verdict colour. */
export type CheckColour = z.infer<typeof checkColourSchema>;

// ─── Per-check result ───────────────────────────────────────────────────────

const checkResultSchema = z.object({
  id: readinessCheckIdSchema,
  verdict: checkColourSchema,
  reason: z.string().check(z.minLength(1)),
  question: z.optional(z.string()),
  evidence: z.optional(z.record(z.string(), z.unknown())),
});

/** Result of a single readiness check. */
export type CheckResult = z.infer<typeof checkResultSchema>;

// ─── Overall verdict ────────────────────────────────────────────────────────

const readinessVerdictSchema = z.object({
  ticketId: z.string().check(z.minLength(1)),
  overall: checkColourSchema,
  checks: z.array(checkResultSchema).check(z.minLength(5)),
  gradedAt: z.string().check(z.minLength(1)),
  rubricSha: z.string().check(z.minLength(1)),
});

/** Full readiness verdict returned by the subagent. */
export type ReadinessVerdict = z.infer<typeof readinessVerdictSchema>;

// ─── Exports for parser + tests ─────────────────────────────────────────────

export { READINESS_CHECK_IDS, readinessVerdictSchema };
