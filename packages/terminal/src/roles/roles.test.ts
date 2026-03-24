/**
 * Structural tests for role markdown files.
 *
 * Verifies the roles directory contains the expected roles and subdirectories
 * that the installer's role-filter module depends on.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROLES_DIR = join(fileURLToPath(import.meta.url), '..');

const CORE_ROLES = ['implementer', 'reviewer', 'setup'];
const OPTIONAL_ROLES = ['planner', 'strategist'];
const ALL_ROLES = [...CORE_ROLES, ...OPTIONAL_ROLES].sort();

const SUBDIRS = ['commands', 'workflows'];

describe('roles directory structure', () => {
  it('contains exactly the expected roles', () => {
    const roles = readdirSync(ROLES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    expect(roles).toEqual(ALL_ROLES);
  });

  ALL_ROLES.forEach((role) => {
    describe(role, () => {
      SUBDIRS.forEach((subdir) => {
        it(`has a ${subdir}/ subdirectory with .md files`, () => {
          const dir = join(ROLES_DIR, role, subdir);
          const files = readdirSync(dir).filter((f) => f.endsWith('.md'));

          expect(files.length).toBeGreaterThan(0);
        });
      });
    });
  });

  it('all command files start with a heading', () => {
    const issues: string[] = [];

    ALL_ROLES.forEach((role) => {
      const cmdDir = join(ROLES_DIR, role, 'commands');
      const files = readdirSync(cmdDir).filter((f) => f.endsWith('.md'));

      files.forEach((file) => {
        const content = readFileSync(join(cmdDir, file), 'utf8');
        const firstLine = content.split('\n')[0]?.trim() ?? '';

        if (!firstLine.startsWith('#')) {
          issues.push(`${role}/commands/${file}`);
        }
      });
    });

    expect(issues).toEqual([]);
  });
});
