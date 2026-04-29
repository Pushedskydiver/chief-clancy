/**
 * Content assertions for the update workflow.
 *
 * Pins the changelog-fetch contract (GitHub releases API with URL-encoded
 * `chief-clancy@` tag) and the unified replaces/preserves prose structure.
 * The earlier shape — a root `CHANGELOG.md` raw fetch — 404'd because
 * changesets emits per-package CHANGELOGs, not a repo-root one.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const content = readFileSync(
  fileURLToPath(new URL('update.md', import.meta.url)),
  'utf8',
);

describe('update workflow', () => {
  it('starts with the correct heading', () => {
    expect(content.split('\n')[0]?.trim()).toBe('# Clancy Update Workflow');
  });
});

describe('changelog fetch', () => {
  it('fetches changelog from GitHub releases API with URL-encoded tag', () => {
    expect(content).toContain(
      'api.github.com/repos/Pushedskydiver/chief-clancy/releases/tags/',
    );
    expect(content).toContain('chief-clancy%40');
  });

  it('does not fetch the (non-existent) repo-root CHANGELOG.md', () => {
    expect(content).not.toContain(
      'raw.githubusercontent.com/Pushedskydiver/chief-clancy/main/CHANGELOG.md',
    );
    expect(content).not.toContain('blob/main/CHANGELOG.md');
  });

  it('provides the releases page as fallback when fetch fails', () => {
    expect(content).toContain(
      'https://github.com/Pushedskydiver/chief-clancy/releases',
    );
  });
});

describe('update notice prose', () => {
  it('replaces list names every path the installer rewrites', () => {
    expect(content).toContain('**This update will replace:**');
    expect(content).toContain('.claude/commands/clancy/');
    expect(content).toContain('.claude/clancy/workflows/');
    expect(content).toContain(
      '.clancy/clancy-implement.js` and `.clancy/clancy-autopilot.js',
    );
    expect(content).toContain(
      '.clancy/version.json` and `.clancy/package.json',
    );
  });

  it('append list names .clancy/.env separately from replaces and preserves', () => {
    expect(content).toContain('**This update may add missing defaults to:**');
    expect(content).toContain(
      '.clancy/.env` — appends pipeline label defaults',
    );
  });

  it('preserves list names paths the installer leaves alone', () => {
    expect(content).toContain('**This update will not touch:**');
    expect(content).toContain('.clancy/docs/');
    expect(content).toContain('.clancy/progress.txt');
    expect(content).toContain('CLAUDE.md');
  });

  it('does not reuse the contradictory "preserved + footnote" framing', () => {
    expect(content).not.toContain('Your project files are preserved');
  });
});
