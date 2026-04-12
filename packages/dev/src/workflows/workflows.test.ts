/**
 * Structural tests for dev workflow files.
 *
 * Verifies the workflows directory contains the expected markdown files
 * that the dev installer depends on.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const WORKFLOWS_DIR = fileURLToPath(new URL('.', import.meta.url));

const EXPECTED_WORKFLOWS = [
  'board-setup.md',
  'dev.md',
  'dev-loop.md',
  'uninstall-dev.md',
];

describe('workflows directory structure', () => {
  it('contains exactly the expected workflow files', () => {
    const workflows = readdirSync(WORKFLOWS_DIR)
      .filter((f) => f.endsWith('.md'))
      .sort();

    expect(workflows).toEqual([...EXPECTED_WORKFLOWS].sort());
  });

  it('all workflow files start with a heading', () => {
    const issues: string[] = [];

    EXPECTED_WORKFLOWS.forEach((file) => {
      const content = readFileSync(new URL(file, import.meta.url), 'utf8');
      const firstLine = content.split('\n')[0]?.trim() ?? '';

      if (!firstLine.startsWith('#')) {
        issues.push(file);
      }
    });

    expect(issues).toEqual([]);
  });

  it('uninstall-dev workflow starts with the correct heading', () => {
    const content = readFileSync(
      new URL('uninstall-dev.md', import.meta.url),
      'utf8',
    );

    expect(content.split('\n')[0]?.trim()).toBe(
      '# Clancy Uninstall Dev Workflow',
    );
  });
});

// ---------------------------------------------------------------------------
// uninstall-dev.md content assertions
// ---------------------------------------------------------------------------

describe('uninstall-dev workflow', () => {
  const content = readFileSync(
    new URL('uninstall-dev.md', import.meta.url),
    'utf8',
  );

  it('detects install location via VERSION.dev marker', () => {
    expect(content).toContain('VERSION.dev');
  });

  it('notes VERSION.dev lives at .clancy/', () => {
    expect(content).toContain('.clancy/VERSION.dev');
  });

  it('lists dev-exclusive files to remove', () => {
    expect(content).toContain('dev.md');
    expect(content).toContain('dev-loop.md');
  });

  it('lists dev bundle files to remove', () => {
    expect(content).toContain('clancy-dev.js');
    expect(content).toContain('clancy-dev-autopilot.js');
  });

  it('lists shared files that require version-marker checks', () => {
    expect(content).toContain('board-setup.md');
    expect(content).toContain('map-codebase.md');
    expect(content).toContain('update-docs.md');
    expect(content).toContain('arch-agent.md');
    expect(content).toContain('concerns-agent.md');
    expect(content).toContain('design-agent.md');
    expect(content).toContain('quality-agent.md');
    expect(content).toContain('tech-agent.md');
  });

  it('checks VERSION markers for all other packages', () => {
    expect(content).toContain('VERSION.brief');
    expect(content).toContain('VERSION.plan');
    expect(content).toContain('commands/clancy/VERSION`');
  });

  it('deletes VERSION.dev last for crash recovery', () => {
    expect(content).toContain('VERSION marker (always last)');
    expect(content).toContain(
      'deleted **last** so that a crash during removal leaves the marker in place',
    );
  });

  it('does not touch hooks, settings, or CLAUDE.md', () => {
    expect(content).toContain('Never touch hooks');
    expect(content).toContain('settings.json');
    expect(content).toContain('CLAUDE.md');
  });

  it('removes the uninstall command itself', () => {
    expect(content).toContain('uninstall-dev.md');
    expect(content).toContain('Uninstall command itself');
  });

  it('cleans up empty directories', () => {
    expect(content).toContain('Clean up empty directories');
    expect(content).toContain('only if it is completely empty');
  });

  it('never removes the .clancy/ directory', () => {
    expect(content).toContain('Never remove the `.clancy/` directory');
    expect(content).toContain('Do not remove `.clancy/`');
  });

  it('checks for clancy-implement.js before removing package.json', () => {
    expect(content).toContain('clancy-implement.js');
    expect(content).toContain('package.json');
  });

  it('provides reinstall instructions in the final message', () => {
    expect(content).toContain('npx @chief-clancy/dev');
  });
});
