/**
 * Structural tests for plan command files.
 *
 * Verifies the commands directory contains the expected markdown files
 * that the plan installer depends on.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const COMMANDS_DIR = fileURLToPath(new URL('.', import.meta.url));

const EXPECTED_COMMANDS = [
  'approve-plan.md',
  'board-setup.md',
  'plan.md',
  'uninstall-plan.md',
  'update-plan.md',
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

  it('uninstall-plan command starts with the uninstall-plan heading', () => {
    const content = readFileSync(
      new URL('uninstall-plan.md', import.meta.url),
      'utf8',
    );

    expect(content.split('\n')[0]?.trim()).toBe('# /clancy:uninstall-plan');
  });

  it('uninstall-plan command references the uninstall-plan workflow', () => {
    const content = readFileSync(
      new URL('uninstall-plan.md', import.meta.url),
      'utf8',
    );

    expect(content).toContain('@.claude/clancy/workflows/uninstall-plan.md');
  });

  it('update-plan command starts with the update-plan heading', () => {
    const content = readFileSync(
      new URL('update-plan.md', import.meta.url),
      'utf8',
    );

    expect(content.split('\n')[0]?.trim()).toBe('# /clancy:update-plan');
  });

  it('update-plan command references the update-plan workflow', () => {
    const content = readFileSync(
      new URL('update-plan.md', import.meta.url),
      'utf8',
    );

    expect(content).toContain('@.claude/clancy/workflows/update-plan.md');
  });
});

// ---------------------------------------------------------------------------
// plan.md content assertions
// ---------------------------------------------------------------------------

describe('plan command', () => {
  const content = readFileSync(new URL('plan.md', import.meta.url), 'utf8');

  it('documents --from flag', () => {
    expect(content).toContain('--from');
  });

  it('shows --from example', () => {
    expect(content).toContain('/clancy:plan --from');
  });

  it('notes --from cannot combine with ticket key', () => {
    expect(content).toContain('Cannot be combined with a ticket key');
  });

  it('documents row selection with bare integer', () => {
    expect(content).toContain('row number to target');
  });

  it('documents --list flag', () => {
    expect(content).toContain('--list');
    expect(content).toContain('inventory');
  });

  it('shows --list example', () => {
    expect(content).toContain('/clancy:plan --list');
  });
});
