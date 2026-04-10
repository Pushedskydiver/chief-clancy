/**
 * Structural tests for agent prompt files.
 *
 * Verifies the agents directory contains the expected prompt files
 * that the installer and map-codebase workflow depend on.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const AGENTS_DIR = fileURLToPath(new URL('.', import.meta.url));

const EXPECTED_AGENTS = ['devils-advocate.md', 'verification-gate.md'];

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

  it('verification-gate.md contains decision response markers', () => {
    const content = readFileSync(
      new URL('verification-gate.md', import.meta.url),
      'utf8',
    );

    expect(content).toContain('"decision"');
    expect(content).toContain('"allow"');
  });
});
