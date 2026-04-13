/**
 * Structural tests for plan agent prompt files.
 *
 * Verifies the agents directory contains the expected prompt files
 * that the plan workflow's DA grill phase depends on.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const AGENTS_DIR = fileURLToPath(new URL('.', import.meta.url));

const EXPECTED_AGENTS = ['devils-advocate.md'];

describe('agents directory structure', () => {
  it('contains exactly the expected agent files', () => {
    const agents = readdirSync(AGENTS_DIR)
      .filter((f) => f.endsWith('.md'))
      .sort();

    expect(agents).toEqual([...EXPECTED_AGENTS].sort());
  });

  it('all agent files start with a heading', () => {
    const issues: string[] = [];

    EXPECTED_AGENTS.forEach((file) => {
      const content = readFileSync(new URL(file, import.meta.url), 'utf8');
      const firstLine = content.split('\n')[0]?.trim() ?? '';

      if (!firstLine.startsWith('#')) {
        issues.push(file);
      }
    });

    expect(issues).toEqual([]);
  });

  it('devils-advocate.md has three output sections', () => {
    const content = readFileSync(
      new URL('devils-advocate.md', import.meta.url),
      'utf8',
    );

    expect(content).toContain('Return exactly three markdown sections');
    expect(content).toContain('## Discovery');
    expect(content).toContain('## Challenges');
    expect(content).toContain('## Open Questions');
  });

  it('devils-advocate.md requires severity levels on Challenges', () => {
    const content = readFileSync(
      new URL('devils-advocate.md', import.meta.url),
      'utf8',
    );

    expect(content).toContain('**Severity:** HIGH | MEDIUM | LOW');
    expect(content).toContain('**Assumption:**');
    expect(content).toContain('**Evidence:**');
    expect(content).toContain('**Suggestion:**');
  });

  it('devils-advocate.md requires severity prefixes on Open Questions', () => {
    const content = readFileSync(
      new URL('devils-advocate.md', import.meta.url),
      'utf8',
    );

    expect(content).toContain('[HIGH]');
    expect(content).toContain('[MEDIUM]');
    expect(content).toContain('[LOW]');
  });

  it('devils-advocate.md has plan health check', () => {
    const content = readFileSync(
      new URL('devils-advocate.md', import.meta.url),
      'utf8',
    );

    expect(content).toContain('## Plan health check');
    expect(content).toContain('Implementation Approach vagueness');
    expect(content).toContain('Affected Files completeness');
    expect(content).toContain('Test Strategy gaps');
    expect(content).toContain('Dependency ordering');
    expect(content).toContain('Risks / Considerations section');
    expect(content).toContain('Architecture alignment');
  });

  it('devils-advocate.md cites sources in Discovery', () => {
    const content = readFileSync(
      new URL('devils-advocate.md', import.meta.url),
      'utf8',
    );

    expect(content).toContain('(Source: codebase)');
    expect(content).toContain('(Source: board)');
    expect(content).toContain('(Source: web)');
  });
});
