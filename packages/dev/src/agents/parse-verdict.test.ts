/**
 * Tests for the verdict parser — extracts a fenced JSON block from
 * Claude output and validates it against the ReadinessVerdict schema.
 */
import { describe, expect, it } from 'vitest';

import { safeParseVerdict } from './parse-verdict.js';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const VALID_VERDICT = {
  ticketId: 'PROJ-42',
  overall: 'green',
  checks: [
    {
      id: 'clear',
      verdict: 'green',
      reason: 'Title and description are clear',
    },
    { id: 'testable', verdict: 'green', reason: 'Has acceptance criteria' },
    { id: 'small', verdict: 'green', reason: 'Single logical change' },
    { id: 'locatable', verdict: 'green', reason: 'Files found via grep' },
    { id: 'touch-bounded', verdict: 'green', reason: 'Touches 2 files' },
  ],
  gradedAt: '2026-04-11T00:00:00Z',
  rubricSha: 'abc123',
};

function wrapInFence(obj: unknown): string {
  return `Some preamble text.\n\n\`\`\`json\n${JSON.stringify(obj, null, 2)}\n\`\`\`\n\nSome trailing text.`;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('safeParseVerdict', () => {
  it('parses a valid verdict from a fenced JSON block', () => {
    const result = safeParseVerdict(wrapInFence(VALID_VERDICT));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.verdict.ticketId).toBe('PROJ-42');
      expect(result.verdict.overall).toBe('green');
      expect(result.verdict.checks).toHaveLength(5);
    }
  });

  it('returns error when no fenced JSON block is found', () => {
    const result = safeParseVerdict('No JSON here at all.');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('No fenced JSON block found');
    }
  });

  it('returns error for malformed JSON', () => {
    const result = safeParseVerdict('```json\n{ broken }\n```');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Invalid JSON');
    }
  });

  it('returns error for valid JSON that fails schema validation', () => {
    const result = safeParseVerdict(wrapInFence({ ticketId: 'X' }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Schema validation failed');
    }
  });

  it('returns error when overall colour is invalid', () => {
    const result = safeParseVerdict(
      wrapInFence({ ...VALID_VERDICT, overall: 'blue' }),
    );

    expect(result.ok).toBe(false);
  });

  it('returns error when a check id is invalid', () => {
    const badChecks = [
      { id: 'unknown-check', verdict: 'green', reason: 'Fine' },
    ];
    const result = safeParseVerdict(
      wrapInFence({ ...VALID_VERDICT, checks: badChecks }),
    );

    expect(result.ok).toBe(false);
  });

  it('returns error when reason is empty', () => {
    const badChecks = [{ id: 'clear', verdict: 'green', reason: '' }];
    const result = safeParseVerdict(
      wrapInFence({ ...VALID_VERDICT, checks: badChecks }),
    );

    expect(result.ok).toBe(false);
  });

  it('accepts optional question and evidence fields', () => {
    const verdict = {
      ...VALID_VERDICT,
      checks: [
        {
          id: 'clear',
          verdict: 'yellow',
          reason: 'Title is vague',
          question: 'What does this ticket do?',
          evidence: { grepTerm: 'auth', hits: 3 },
        },
        ...VALID_VERDICT.checks.slice(1),
      ],
    };

    const result = safeParseVerdict(wrapInFence(verdict));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.verdict.checks[0].question).toBe(
        'What does this ticket do?',
      );
      expect(result.verdict.checks[0].evidence).toEqual({
        grepTerm: 'auth',
        hits: 3,
      });
    }
  });

  it('extracts the first fenced JSON block when multiple exist', () => {
    const text = [
      'First block:',
      '```json',
      JSON.stringify(VALID_VERDICT),
      '```',
      'Second block:',
      '```json',
      '{"ticketId": "OTHER"}',
      '```',
    ].join('\n');

    const result = safeParseVerdict(text);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.verdict.ticketId).toBe('PROJ-42');
    }
  });

  it('returns error when ticketId is missing', () => {
    const noTicketId = { ...VALID_VERDICT, ticketId: undefined };
    const result = safeParseVerdict(wrapInFence(noTicketId));

    expect(result.ok).toBe(false);
  });

  it('returns error when gradedAt is missing', () => {
    const noGradedAt = { ...VALID_VERDICT, gradedAt: undefined };
    const result = safeParseVerdict(wrapInFence(noGradedAt));

    expect(result.ok).toBe(false);
  });
});
