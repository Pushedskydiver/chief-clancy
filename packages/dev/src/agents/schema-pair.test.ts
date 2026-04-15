/**
 * Schema-pair check — asserts that the check ids in readiness.md match
 * the ReadinessCheckId union in types.ts.
 *
 * This test fails the build if the two sides drift. See
 * docs/DA-REVIEW.md "Schema-pair check" for why this matters.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { READINESS_CHECK_IDS } from './types.js';

const RUBRIC_PATH = join(import.meta.dirname, 'readiness.md');

function extractCheckIds(markdown: string): readonly string[] {
  const afterChecks = markdown.split('## Checks')[1];

  if (!afterChecks) {
    throw new Error('No "## Checks" section found in readiness.md');
  }

  // Stop at the next ## heading so unrelated ### headings aren't included
  const checksSection = afterChecks.split(/^## /m)[0];

  const headingRe = /^### (\S+)/gm;

  return [...checksSection.matchAll(headingRe)]
    .map((m) => m[1])
    .filter((id): id is string => id !== undefined);
}

describe('readiness.md ↔ ReadinessCheckId schema pair', () => {
  it('readiness.md headings match READINESS_CHECK_IDS exactly', () => {
    const markdown = readFileSync(RUBRIC_PATH, 'utf8');
    const markdownIds = extractCheckIds(markdown);

    expect(new Set(markdownIds)).toEqual(new Set(READINESS_CHECK_IDS));
  });

  it('readiness.md headings are in the same order as READINESS_CHECK_IDS', () => {
    const markdown = readFileSync(RUBRIC_PATH, 'utf8');
    const markdownIds = extractCheckIds(markdown);

    expect(markdownIds).toEqual([...READINESS_CHECK_IDS]);
  });

  it('has exactly 5 check headings', () => {
    const markdown = readFileSync(RUBRIC_PATH, 'utf8');
    const markdownIds = extractCheckIds(markdown);

    expect(markdownIds).toHaveLength(5);
  });
});
