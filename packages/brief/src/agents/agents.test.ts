/**
 * Structural tests for brief agent prompt files.
 *
 * Verifies the agents directory contains the expected prompt files
 * that the brief workflow's AI-grill phase depends on.
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

  it('devils-advocate.md contains confidence classification', () => {
    const content = readFileSync(
      new URL('devils-advocate.md', import.meta.url),
      'utf8',
    );

    expect(content).toContain('Answerable');
    expect(content).toContain('Open Questions');
  });
});
