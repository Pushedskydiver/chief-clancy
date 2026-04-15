/**
 * Tests for the readiness report writer — markdown + JSON artifacts.
 */
import type { ReadinessVerdict } from '../agents/types.js';
import type { AtomicFs } from './atomic-write.js';

import { describe, expect, it, vi } from 'vitest';

import { writeReadinessReport } from './readiness-report.js';

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeVerdict(
  ticketId: string,
  overall: 'green' | 'yellow' | 'red',
): ReadinessVerdict {
  return {
    ticketId,
    overall,
    checks: [
      { id: 'clear', verdict: overall, reason: `${overall} clear` },
      { id: 'testable', verdict: overall, reason: `${overall} testable` },
      { id: 'small', verdict: overall, reason: `${overall} small` },
      { id: 'locatable', verdict: overall, reason: `${overall} locatable` },
      { id: 'touch-bounded', verdict: overall, reason: `${overall} bounded` },
    ],
    gradedAt: '2026-04-11T10:00:00Z',
    rubricSha: 'abc123',
  };
}

type TestFs = AtomicFs & { readonly written: ReadonlyMap<string, string> };

function makeFs(overrides?: { readonly stat?: AtomicFs['stat'] }): TestFs {
  const written = new Map<string, string>();
  return {
    written,
    mkdir: vi.fn(),
    writeFile: vi.fn((p: string, c: string) => {
      written.set(p, c);
    }),
    rename: vi.fn(),
    readdir: vi.fn(() => []),
    unlink: vi.fn(),
    stat: overrides?.stat ?? vi.fn(() => undefined),
  };
}

const BASE_DIR = '/project/.clancy/dev';

// ─── writeReadinessReport ──────────────────────────────────────────────────

describe('writeReadinessReport', () => {
  it('writes markdown report with frontmatter header', () => {
    const fs = makeFs();
    const verdicts = [makeVerdict('PROJ-1', 'green')];

    writeReadinessReport({
      fs,
      dir: BASE_DIR,
      verdicts,
      warnings: [],
      timestamp: () => '2026-04-11T10-00-00',
    });

    const md = fs.written.get(`${BASE_DIR}/readiness-report.md.tmp`);
    expect(md).toBeDefined();
    expect(md).toContain('# Readiness Report');
    expect(md).toContain('total: 1');
    expect(md).toContain('## Green (1)');
    expect(md).toContain('PROJ-1');
  });

  it('writes JSON sibling with structured data', () => {
    const fs = makeFs();
    const verdicts = [makeVerdict('PROJ-1', 'green')];

    writeReadinessReport({
      fs,
      dir: BASE_DIR,
      verdicts,
      warnings: [],
      timestamp: () => '2026-04-11T10-00-00',
    });

    const json = fs.written.get(`${BASE_DIR}/readiness-report.json.tmp`);
    expect(json).toBeDefined();
    const parsed = JSON.parse(json!);
    expect(parsed.total).toBe(1);
    expect(parsed.green).toHaveLength(1);
    expect(parsed.yellow).toHaveLength(0);
    expect(parsed.red).toHaveLength(0);
  });

  it('groups verdicts into colour buckets ordered red → yellow → green', () => {
    const fs = makeFs();
    const verdicts = [
      makeVerdict('PROJ-1', 'green'),
      makeVerdict('PROJ-2', 'red'),
      makeVerdict('PROJ-3', 'yellow'),
      makeVerdict('PROJ-4', 'green'),
    ];

    writeReadinessReport({
      fs,
      dir: BASE_DIR,
      verdicts,
      warnings: [],
      timestamp: () => '2026-04-11T10-00-00',
    });

    const md = fs.written.get(`${BASE_DIR}/readiness-report.md.tmp`)!;
    const redIdx = md.indexOf('## Red');
    const yellowIdx = md.indexOf('## Yellow');
    const greenIdx = md.indexOf('## Green');

    // Red appears before yellow, yellow before green
    expect(redIdx).toBeLessThan(yellowIdx);
    expect(yellowIdx).toBeLessThan(greenIdx);
  });

  it('omits empty buckets from markdown', () => {
    const fs = makeFs();
    const verdicts = [makeVerdict('PROJ-1', 'green')];

    writeReadinessReport({
      fs,
      dir: BASE_DIR,
      verdicts,
      warnings: [],
      timestamp: () => '2026-04-11T10-00-00',
    });

    const md = fs.written.get(`${BASE_DIR}/readiness-report.md.tmp`)!;
    expect(md).not.toContain('## Red');
    expect(md).not.toContain('## Yellow');
    expect(md).toContain('## Green');
  });

  it('handles empty verdict list', () => {
    const fs = makeFs();

    writeReadinessReport({
      fs,
      dir: BASE_DIR,
      verdicts: [],
      warnings: [],
      timestamp: () => '2026-04-11T10-00-00',
    });

    const md = fs.written.get(`${BASE_DIR}/readiness-report.md.tmp`)!;
    expect(md).toContain('total: 0');
    expect(md).toContain('No verdicts to report.');
  });

  it('includes warnings in the report header', () => {
    const fs = makeFs();
    const verdicts = [makeVerdict('PROJ-1', 'green')];
    const warnings = [
      'Batch truncated from 60 to 50 — use --max-batch=N to override',
      'Duplicate ticket PROJ-2 removed (kept first occurrence)',
    ];

    writeReadinessReport({
      fs,
      dir: BASE_DIR,
      verdicts,
      warnings,
      timestamp: () => '2026-04-11T10-00-00',
    });

    const md = fs.written.get(`${BASE_DIR}/readiness-report.md.tmp`)!;
    expect(md).toContain('## Warnings');
    expect(md).toContain('- Batch truncated');
    expect(md).toContain('- Duplicate ticket');
  });

  it('rotates existing report before writing new one', () => {
    const fs = makeFs({ stat: vi.fn(() => ({ mtimeMs: Date.now() })) });

    writeReadinessReport({
      fs,
      dir: BASE_DIR,
      verdicts: [makeVerdict('PROJ-1', 'green')],
      warnings: [],
      timestamp: () => '2026-04-11T10-00-00',
    });

    // Should rename existing .md and .json before writing new
    expect(fs.rename).toHaveBeenCalledWith(
      `${BASE_DIR}/readiness-report.md`,
      `${BASE_DIR}/readiness-report.2026-04-11T10-00-00.md`,
    );
  });

  it('includes per-check details in markdown', () => {
    const fs = makeFs();
    const verdict = makeVerdict('PROJ-1', 'yellow');
    verdict.checks[0] = {
      id: 'clear',
      verdict: 'yellow',
      reason: 'Acceptance criteria are vague',
      question: 'What does "fast" mean?',
    };

    writeReadinessReport({
      fs,
      dir: BASE_DIR,
      verdicts: [verdict],
      warnings: [],
      timestamp: () => '2026-04-11T10-00-00',
    });

    const md = fs.written.get(`${BASE_DIR}/readiness-report.md.tmp`)!;
    expect(md).toContain('Acceptance criteria are vague');
    expect(md).toContain('What does "fast" mean?');
  });
});
