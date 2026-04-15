/**
 * Rubric fitness test — deterministic mock grader applies the 5 rubric
 * checks as pure functions against 20 ticket fixtures.
 *
 * Asserts ≥16/20 correct classifications. The mock grader approximates
 * what a real Claude grading would produce — it's a sanity check that
 * the rubric checks are discriminating, not a substitute for live grading.
 */
import type { CheckColour, CheckResult, ReadinessCheckId } from './types.js';

import { describe, expect, it } from 'vitest';

import { aggregateVerdict } from './aggregate.js';
import { BAD_TICKETS, GOOD_TICKETS } from './fixtures/tickets.js';
import { READINESS_CHECK_IDS } from './types.js';

// ─── Mock grader (pure functions, one per check) ────────────────────────────

function gradeClear(title: string, description: string): CheckColour {
  if (!title || title.length < 5) return 'red';
  if (!description || description.length < 20) return 'red';
  if (
    /^(feat|fix|chore|refactor|test|docs|perf|ci|build|style):?\s*$/.test(title)
  )
    return 'red';
  if (title.length < 15 && description.length < 30) return 'yellow';
  return 'green';
}

function gradeTestable(description: string): CheckColour {
  const hasSignal =
    /test|assert|expect|accept|criteria|endpoint|\.test\.|\.spec\.|coverage|verify/i.test(
      description,
    );
  const isVague = /works? correctly|should work|be secure|load quickly/i.test(
    description,
  );
  if (!hasSignal) return 'red';
  if (isVague && !description.includes('Accept:')) return 'yellow';
  return 'green';
}

function gradeSmall(description: string): CheckColour {
  const subItemCount = (description.match(/\d\)\s|\d\.\s/g) ?? []).length;
  const hasBigMarker =
    /big one|update everywhere|entire codebase|all (api|component|test|depend)/i.test(
      description,
    );
  if (subItemCount >= 4 || hasBigMarker) return 'red';
  if (subItemCount >= 2) return 'yellow';
  return 'green';
}

function gradeLocatable(description: string): CheckColour {
  const hasPath = /src\/|\.tsx?|\.jsx?|\.json|\.md|package\.json|README/i.test(
    description,
  );
  if (hasPath) return 'green';
  if (description.length > 50) return 'yellow';
  return 'red';
}

function gradeTouchBounded(description: string): CheckColour {
  const hasBoundary =
    /single file|one file|two files|touches \w+\.tsx? only|touches \w+\.\w+/i.test(
      description,
    );
  const isCrossCutting =
    /update everywhere|every component|all (api|test|depend)|entire codebase/i.test(
      description,
    );
  if (isCrossCutting) return 'red';
  if (hasBoundary) return 'green';
  return 'yellow';
}

const GRADERS: Record<
  ReadinessCheckId,
  (title: string, description: string) => CheckColour
> = {
  clear: gradeClear,
  testable: (_, d) => gradeTestable(d),
  small: (_, d) => gradeSmall(d),
  locatable: (_, d) => gradeLocatable(d),
  'touch-bounded': (_, d) => gradeTouchBounded(d),
};

function mockGrade(
  title: string,
  description: string,
): { readonly overall: CheckColour; readonly checks: readonly CheckResult[] } {
  const checks: readonly CheckResult[] = READINESS_CHECK_IDS.map((id) => ({
    id,
    verdict: GRADERS[id](title, description),
    reason: `Mock grade for ${id}`,
  }));

  return { overall: aggregateVerdict(checks), checks };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('rubric fitness (mock grader)', () => {
  const allTickets = [...GOOD_TICKETS, ...BAD_TICKETS];

  const results = allTickets.map((ticket) => {
    const grade = mockGrade(ticket.title, ticket.description);
    const actual = grade.overall === 'green' ? 'green' : 'not-green';
    return {
      ticket,
      actual,
      expected: ticket.expected,
      correct: actual === ticket.expected,
    };
  });

  it('classifies ≥16 out of 20 tickets correctly', () => {
    const correctCount = results.filter((r) => r.correct).length;

    // Log misclassifications for debugging
    const misses = results
      .filter((r) => !r.correct)
      .map((r) => `  ${r.ticket.id}: expected=${r.expected}, got=${r.actual}`);

    expect(
      correctCount,
      `Misclassified:\n${misses.join('\n')}`,
    ).toBeGreaterThanOrEqual(16);
  });

  it('classifies ≥8 of 10 good tickets as green', () => {
    const goodResults = results.filter((r) => r.ticket.expected === 'green');
    const correctGood = goodResults.filter((r) => r.correct).length;

    expect(correctGood).toBeGreaterThanOrEqual(8);
  });

  it('classifies ≥8 of 10 bad tickets as not-green', () => {
    const badResults = results.filter((r) => r.ticket.expected === 'not-green');
    const correctBad = badResults.filter((r) => r.correct).length;

    expect(correctBad).toBeGreaterThanOrEqual(8);
  });
});
