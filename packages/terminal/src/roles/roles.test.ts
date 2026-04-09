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

const ROLES_DIR = fileURLToPath(new URL('.', import.meta.url));

const CORE_ROLES = ['implementer', 'reviewer', 'setup'];
// ALL_ROLES intentionally equals CORE_ROLES — both planner and strategist are
// virtual roles, so the structural assertions below only iterate the on-disk
// core roles. The virtual roles are validated separately by the
// VIRTUAL_ROLES.forEach block below (which asserts they have NO directory).
const ALL_ROLES = [...CORE_ROLES].sort();

/**
 * Roles that exist as a config-gate concept (in `installer/ui.ts` and the
 * `plan-content` / `brief-content` install gates) but no longer ship any
 * terminal-owned files. Their `src/{commands,workflows}/` files live in the
 * standalone packages (`@chief-clancy/plan` and `@chief-clancy/brief`), and
 * the terminal installer copies them in via `plan-content.ts` /
 * `brief-content.ts`.
 *
 * The structural test asserts these roles are NOT present as directories on
 * disk so a half-finished move can't sneak past review.
 */
const VIRTUAL_ROLES = ['planner', 'strategist'];

const SUBDIRS = ['commands', 'workflows'];

describe('roles directory structure', () => {
  it('contains exactly the expected roles', () => {
    const roles = readdirSync(ROLES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    expect(roles).toEqual(ALL_ROLES);
  });

  VIRTUAL_ROLES.forEach((role) => {
    it(`virtual role "${role}" has no on-disk role directory`, () => {
      const roles = readdirSync(ROLES_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      expect(roles).not.toContain(role);
    });
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

  SUBDIRS.forEach((subdir) => {
    it(`has no duplicate filenames across roles in ${subdir}/`, () => {
      const seen = new Map<string, string>();
      const duplicates: string[] = [];

      ALL_ROLES.forEach((role) => {
        const dir = join(ROLES_DIR, role, subdir);
        const files = readdirSync(dir).filter((f) => f.endsWith('.md'));

        files.forEach((file) => {
          const existing = seen.get(file);

          if (existing) {
            duplicates.push(`${file} in both ${existing} and ${role}`);
          } else {
            seen.set(file, role);
          }
        });
      });

      expect(duplicates).toEqual([]);
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
