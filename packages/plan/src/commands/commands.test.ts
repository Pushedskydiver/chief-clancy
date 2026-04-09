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
  'implement-from.md',
  'plan.md',
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
});

// ---------------------------------------------------------------------------
// plan.md content assertions
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// implement-from.md content assertions
// ---------------------------------------------------------------------------

describe('implement-from command', () => {
  const content = readFileSync(
    new URL('implement-from.md', import.meta.url),
    'utf8',
  );

  it('documents path-form argument', () => {
    expect(content).toContain('.clancy/plans/add-dark-mode-2.md');
  });

  it('documents bare-stem-form argument', () => {
    expect(content).toContain('Bare stem');
  });

  it('documents --bypass-approval flag', () => {
    expect(content).toContain('--bypass-approval');
  });

  it('warns that --afk does not imply --bypass-approval', () => {
    expect(content).toContain('--afk');
    expect(content).toContain('does NOT bypass');
  });

  it('contrasts with terminal /clancy:implement', () => {
    expect(content).toContain('/clancy:implement');
    expect(content).toContain('terminal');
  });

  it('references the workflow file', () => {
    expect(content).toContain('@.claude/clancy/workflows/implement-from.md');
  });
});

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
