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
  'update-dev.md',
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
    expect(content).toContain('update-dev.md');
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
    expect(content).toContain('.claude/commands/clancy/VERSION');
    expect(content).toContain('~/.claude/commands/clancy/VERSION');
  });

  it('scopes .clancy/ removals to project uninstall only', () => {
    expect(content).toContain('Global only');
    expect(content).toContain('do **not** remove anything from `.clancy/`');
  });

  it('deletes VERSION.dev last for crash recovery', () => {
    expect(content).toContain('VERSION marker (always last');
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

// ---------------------------------------------------------------------------
// update-dev.md content assertions
// ---------------------------------------------------------------------------

describe('update-dev workflow', () => {
  const content = readFileSync(
    new URL('update-dev.md', import.meta.url),
    'utf8',
  );

  it('starts with the correct heading', () => {
    expect(content.split('\n')[0]?.trim()).toBe('# Clancy Update Dev Workflow');
  });

  it('detects installed version via VERSION.dev at .clancy/', () => {
    expect(content).toContain('.clancy/VERSION.dev');
  });

  it('detects global install via dev.md marker', () => {
    expect(content).toContain('~/.claude/commands/clancy/dev.md');
  });

  it('checks npm for latest version with timeout', () => {
    expect(content).toContain('npm view @chief-clancy/dev version');
    expect(content).toContain('5-second timeout');
  });

  it('uses npx with @latest suffix to bypass cache', () => {
    expect(content).toContain('npx -y @chief-clancy/dev@latest');
  });

  it('supports --afk flag to skip confirmation', () => {
    expect(content).toContain('--afk');
  });

  it('shows terminal coexistence advisory', () => {
    expect(content).toContain('Terminal pipeline detected');
    expect(content).toContain('/clancy:update-terminal');
    expect(content).toContain('file manifest will become stale');
  });

  it('shows other standalone advisory', () => {
    expect(content).toContain('Other Clancy packages detected');
    expect(content).toContain('overwritten with this package');
  });

  it('detects install mode (local, both)', () => {
    expect(content).toContain('Detect install mode');
    expect(content).toContain('`local`');
    expect(content).toContain('`both`');
  });

  it('mentions runtime bundles in confirmation', () => {
    expect(content).toContain('clancy-dev.js');
    expect(content).toContain('clancy-dev-autopilot.js');
  });

  it('verifies update took effect', () => {
    expect(content).toContain('.clancy/VERSION.dev');
    expect(content).toContain('npm CDN cache');
  });

  it('fetches changelog from GitHub releases API with URL-encoded tag', () => {
    expect(content).toContain(
      'api.github.com/repos/Pushedskydiver/chief-clancy/releases/tags/',
    );
    expect(content).toContain('%40chief-clancy%2Fdev%40');
  });

  it('provides fallback URL when changelog fetch fails', () => {
    expect(content).toContain(
      'https://github.com/Pushedskydiver/chief-clancy/releases',
    );
  });

  it('checks VERSION markers for other packages', () => {
    expect(content).toContain('VERSION.brief');
    expect(content).toContain('VERSION.plan');
    expect(content).toContain('<base>/commands/clancy/VERSION`');
  });

  it('does not touch hooks, settings, CLAUDE.md, or .clancy/.env', () => {
    expect(content).toContain(
      'Never touch hooks, `settings.json`, `CLAUDE.md`, `.gitignore`, `.prettierignore`, or `.clancy/.env`',
    );
  });

  it('includes the dev-specific Clancy quote in the final message only', () => {
    expect(content).toContain('Dispatch updated, back on patrol.');
  });

  it('instructs to start a new session after update', () => {
    expect(content).toContain(
      'Start a new Claude Code session to pick up the updated commands.',
    );
  });

  it('does not delete files — only overwrites via installer', () => {
    expect(content).toContain('does NOT delete files');
  });

  it('notes VERSION.dev is always at .clancy/', () => {
    expect(content).toContain('VERSION.dev is always at `.clancy/VERSION.dev`');
  });
});
