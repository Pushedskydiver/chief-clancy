/**
 * Structural tests for the CLAUDE.md template.
 *
 * Verifies the template file exists, has the expected markers, and
 * contains the key sections that the installer merges into user projects.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const TEMPLATES_DIR = fileURLToPath(new URL('.', import.meta.url));

describe('templates directory structure', () => {
  it('contains exactly CLAUDE.md', () => {
    const files = readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith('.md'));

    expect(files).toEqual(['CLAUDE.md']);
  });
});

describe('CLAUDE.md template', () => {
  const content = readFileSync(new URL('CLAUDE.md', import.meta.url), 'utf8');

  it('has clancy:start and clancy:end markers', () => {
    expect(content).toContain('<!-- clancy:start -->');
    expect(content).toContain('<!-- clancy:end -->');
  });

  it('starts with clancy:start and ends with clancy:end', () => {
    const trimmed = content.trim();

    expect(trimmed.startsWith('<!-- clancy:start -->')).toBe(true);
    expect(trimmed.endsWith('<!-- clancy:end -->')).toBe(true);
  });

  it('contains required sections', () => {
    const requiredSections = [
      '### Version check',
      '### Docs',
      '### Executability check',
      '### Git workflow',
      '### Progress',
    ];

    requiredSections.forEach((section) => {
      expect(content).toContain(section);
    });
  });
});
