import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { copyRoleFiles } from './role-filter.js';

let testDir: string;

function createRole(
  role: string,
  subdir: string,
  files: readonly string[],
): void {
  const dir = join(testDir, 'roles', role, subdir);
  mkdirSync(dir, { recursive: true });
  files.forEach((file) => {
    writeFileSync(join(dir, file), `# ${role}/${file}`);
  });
}

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'role-filter-test-'));
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('copyRoleFiles', () => {
  it('installs all roles when enabledRoles is null (first install)', () => {
    createRole('implementer', 'commands', ['run.md']);
    createRole('planner', 'commands', ['plan.md']);

    const dest = join(testDir, 'dest');
    copyRoleFiles({
      rolesDir: join(testDir, 'roles'),
      subdir: 'commands',
      dest,
      enabledRoles: null,
    });

    expect(existsSync(join(dest, 'run.md'))).toBe(true);
    expect(existsSync(join(dest, 'plan.md'))).toBe(true);
  });

  it('installs only core roles when enabledRoles is empty', () => {
    createRole('implementer', 'commands', ['run.md']);
    createRole('reviewer', 'commands', ['review.md']);
    createRole('planner', 'commands', ['plan.md']);

    const dest = join(testDir, 'dest');
    copyRoleFiles({
      rolesDir: join(testDir, 'roles'),
      subdir: 'commands',
      dest,
      enabledRoles: new Set<string>(),
    });

    expect(existsSync(join(dest, 'run.md'))).toBe(true);
    expect(existsSync(join(dest, 'review.md'))).toBe(true);
    expect(existsSync(join(dest, 'plan.md'))).toBe(false);
  });

  it('installs core + specified optional roles', () => {
    createRole('implementer', 'commands', ['run.md']);
    createRole('planner', 'commands', ['plan.md']);
    createRole('strategist', 'commands', ['approve-brief.md']);

    const dest = join(testDir, 'dest');
    copyRoleFiles({
      rolesDir: join(testDir, 'roles'),
      subdir: 'commands',
      dest,
      enabledRoles: new Set(['planner']),
    });

    expect(existsSync(join(dest, 'run.md'))).toBe(true);
    expect(existsSync(join(dest, 'plan.md'))).toBe(true);
    expect(existsSync(join(dest, 'approve-brief.md'))).toBe(false);
  });

  it('removes previously-installed files for disabled optional roles', () => {
    createRole('planner', 'commands', ['plan.md']);

    const dest = join(testDir, 'dest');
    mkdirSync(dest, { recursive: true });
    writeFileSync(join(dest, 'plan.md'), '# old planner file');

    copyRoleFiles({
      rolesDir: join(testDir, 'roles'),
      subdir: 'commands',
      dest,
      enabledRoles: new Set<string>(),
    });

    expect(existsSync(join(dest, 'plan.md'))).toBe(false);
  });

  it('skips roles without the target subdir', () => {
    createRole('implementer', 'commands', ['run.md']);
    mkdirSync(join(testDir, 'roles', 'reviewer'), { recursive: true });

    const dest = join(testDir, 'dest');
    copyRoleFiles({
      rolesDir: join(testDir, 'roles'),
      subdir: 'commands',
      dest,
      enabledRoles: null,
    });

    expect(existsSync(join(dest, 'run.md'))).toBe(true);
  });

  it('propagates non-ENOENT errors when unlinking disabled role files (M9)', () => {
    // Source has a file named 'conflict'
    createRole('optional', 'commands', ['conflict']);

    const dest = join(testDir, 'dest');
    mkdirSync(dest, { recursive: true });
    // Dest has a directory named 'conflict' — unlinkSync on a dir throws EPERM/EISDIR
    mkdirSync(join(dest, 'conflict'), { recursive: true });

    expect(() =>
      copyRoleFiles({
        rolesDir: join(testDir, 'roles'),
        subdir: 'commands',
        dest,
        enabledRoles: new Set<string>(),
      }),
    ).toThrow();
  });

  it('removes subdirectories from dest for disabled roles (M6)', () => {
    createRole('planner', 'commands', ['plan.md']);
    // Add a nested subdirectory inside the role's commands dir
    const nestedSrc = join(testDir, 'roles', 'planner', 'commands', 'nested');
    mkdirSync(nestedSrc, { recursive: true });
    writeFileSync(join(nestedSrc, 'deep.md'), '# nested');

    const dest = join(testDir, 'dest');
    mkdirSync(join(dest, 'nested'), { recursive: true });
    writeFileSync(join(dest, 'plan.md'), '# old planner file');
    writeFileSync(join(dest, 'nested', 'deep.md'), '# old nested file');

    copyRoleFiles({
      rolesDir: join(testDir, 'roles'),
      subdir: 'commands',
      dest,
      enabledRoles: new Set<string>(),
    });

    expect(existsSync(join(dest, 'plan.md'))).toBe(false);
    expect(existsSync(join(dest, 'nested'))).toBe(false);
  });

  it('copies nested directory content for enabled roles', () => {
    createRole('implementer', 'commands', ['run.md']);
    // Add a nested subdirectory with a file
    const nestedDir = join(
      testDir,
      'roles',
      'implementer',
      'commands',
      'workflows',
    );
    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(join(nestedDir, 'deploy.md'), '# deploy workflow');

    const dest = join(testDir, 'dest');
    copyRoleFiles({
      rolesDir: join(testDir, 'roles'),
      subdir: 'commands',
      dest,
      enabledRoles: null,
    });

    // copyDir recursively copies — nested content is preserved
    expect(existsSync(join(dest, 'run.md'))).toBe(true);
    expect(existsSync(join(dest, 'workflows', 'deploy.md'))).toBe(true);
  });
});
