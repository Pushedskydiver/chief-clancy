/**
 * Structural tests for dev command files.
 *
 * Verifies the commands directory contains the expected markdown files
 * that the dev installer depends on.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const COMMANDS_DIR = fileURLToPath(new URL('.', import.meta.url));

const EXPECTED_COMMANDS = [
  'board-setup.md',
  'dev.md',
  'dev-loop.md',
  'uninstall-dev.md',
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

  it('uninstall-dev command starts with the uninstall-dev heading', () => {
    const content = readFileSync(
      new URL('uninstall-dev.md', import.meta.url),
      'utf8',
    );

    expect(content.split('\n')[0]?.trim()).toBe('# /clancy:uninstall-dev');
  });

  it('uninstall-dev command references the uninstall-dev workflow', () => {
    const content = readFileSync(
      new URL('uninstall-dev.md', import.meta.url),
      'utf8',
    );

    expect(content).toContain('@.claude/clancy/workflows/uninstall-dev.md');
  });
});
