/**
 * Structural tests for brief command files.
 *
 * Verifies the commands directory contains the expected markdown files
 * that the brief installer depends on.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const COMMANDS_DIR = fileURLToPath(new URL('.', import.meta.url));

const EXPECTED_COMMANDS = [
  'approve-brief.md',
  'board-setup.md',
  'brief.md',
  'uninstall-brief.md',
];

describe('commands directory structure', () => {
  it('contains exactly the expected command files', () => {
    const commands = readdirSync(COMMANDS_DIR)
      .filter((f) => f.endsWith('.md'))
      .sort();

    expect(commands).toEqual([...EXPECTED_COMMANDS].sort());
  });

  it('all command files start with a heading', () => {
    const issues: string[] = [];

    EXPECTED_COMMANDS.forEach((file) => {
      const content = readFileSync(new URL(file, import.meta.url), 'utf8');
      const firstLine = content.split('\n')[0]?.trim() ?? '';

      if (!firstLine.startsWith('#')) {
        issues.push(file);
      }
    });

    expect(issues).toEqual([]);
  });

  it('approve-brief command starts with the approve-brief heading', () => {
    const content = readFileSync(
      new URL('approve-brief.md', import.meta.url),
      'utf8',
    );

    expect(content.split('\n')[0]?.trim()).toBe('# /clancy:approve-brief');
  });

  it('uninstall-brief command starts with the uninstall-brief heading', () => {
    const content = readFileSync(
      new URL('uninstall-brief.md', import.meta.url),
      'utf8',
    );

    expect(content.split('\n')[0]?.trim()).toBe('# /clancy:uninstall-brief');
  });

  it('uninstall-brief command references the uninstall-brief workflow', () => {
    const content = readFileSync(
      new URL('uninstall-brief.md', import.meta.url),
      'utf8',
    );

    expect(content).toContain('@.claude/clancy/workflows/uninstall-brief.md');
  });
});
