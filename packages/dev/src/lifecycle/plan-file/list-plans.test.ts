import type { ListPlansFs } from './list-plans.js';

import { describe, expect, it } from 'vitest';

import { listPlanFiles } from './list-plans.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const MINIMAL_PLAN = `## Clancy Implementation Plan

**Source:** .clancy/briefs/test.md
**Row:** #1 — Test feature
**Planned:** 2026-04-13

### Summary

A test plan.

### Size Estimate

**S** — Small
`;

function createFs(
  files: Record<string, string>,
  approvedSlugs: readonly string[] = [],
): ListPlansFs {
  const entries = Object.keys(files);
  return {
    readdir: () => entries,
    exists: (path: string) =>
      approvedSlugs.some((s) => path.endsWith(`${s}.approved`)),
  };
}

// ─── Directory listing ──────────────────────────────────────────────────────

describe('listPlanFiles — directory listing', () => {
  it('returns only .md files', () => {
    const fs = createFs({
      'plan-1.md': MINIMAL_PLAN,
      'plan-2.md': MINIMAL_PLAN,
      'notes.txt': 'not a plan',
      '.approved': 'marker',
    });

    const result = listPlanFiles('/plans', fs);

    expect(result).toHaveLength(2);
    expect(result.map((e) => e.slug)).toEqual(['plan-1', 'plan-2']);
  });

  it('returns empty list for empty directory', () => {
    const fs = createFs({});

    const result = listPlanFiles('/plans', fs);

    expect(result).toEqual([]);
  });

  it('constructs full path from directory + filename', () => {
    const fs = createFs({ 'my-plan.md': MINIMAL_PLAN });

    const result = listPlanFiles('/some/dir', fs);

    expect(result[0].path).toBe('/some/dir/my-plan.md');
  });
});

// ─── Natural sort ───────────────────────────────────────────────────────────

describe('listPlanFiles — natural sort', () => {
  it('sorts numerically: 1, 2, 10 (not 1, 10, 2)', () => {
    const fs = createFs({
      'add-feature-10.md': MINIMAL_PLAN,
      'add-feature-2.md': MINIMAL_PLAN,
      'add-feature-1.md': MINIMAL_PLAN,
    });

    const result = listPlanFiles('/plans', fs);

    expect(result.map((e) => e.slug)).toEqual([
      'add-feature-1',
      'add-feature-2',
      'add-feature-10',
    ]);
  });

  it('handles mixed prefixes with numeric suffixes', () => {
    const fs = createFs({
      'beta-3.md': MINIMAL_PLAN,
      'alpha-1.md': MINIMAL_PLAN,
      'alpha-2.md': MINIMAL_PLAN,
    });

    const result = listPlanFiles('/plans', fs);

    expect(result.map((e) => e.slug)).toEqual(['alpha-1', 'alpha-2', 'beta-3']);
  });
});

// ─── Approval status ────────────────────────────────────────────────────────

describe('listPlanFiles — approval status', () => {
  it('marks approved plans', () => {
    const fs = createFs({ 'my-plan.md': MINIMAL_PLAN }, ['my-plan']);

    const result = listPlanFiles('/plans', fs);

    expect(result[0].approved).toBe(true);
  });

  it('marks unapproved plans', () => {
    const fs = createFs({ 'my-plan.md': MINIMAL_PLAN });

    const result = listPlanFiles('/plans', fs);

    expect(result[0].approved).toBe(false);
  });
});
