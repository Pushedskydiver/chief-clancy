import { join } from 'node:path';

import {
  parseEnabledRoles,
  parseInstallFlag,
  resolveInstallPaths,
  validateSources,
} from '~/t/installer/install/install.js';
import { describe, expect, it } from 'vitest';

describe('parseInstallFlag', () => {
  it('returns "global" when --global is present', () => {
    expect(parseInstallFlag(['--global'])).toBe('global');
  });

  it('returns "local" when --local is present', () => {
    expect(parseInstallFlag(['--local'])).toBe('local');
  });

  it('returns null when no flag is present', () => {
    expect(parseInstallFlag([])).toBeNull();
  });

  it('returns null for unrelated flags', () => {
    expect(parseInstallFlag(['--verbose', '--force'])).toBeNull();
  });

  it('prefers --global when both flags are present', () => {
    expect(parseInstallFlag(['--global', '--local'])).toBe('global');
  });

  it('ignores positional arguments', () => {
    expect(parseInstallFlag(['install', '--global'])).toBe('global');
  });
});

describe('resolveInstallPaths', () => {
  const homeDir = '/home/user';
  const cwd = '/projects/my-app';

  describe('global mode', () => {
    it('resolves commands destination under ~/.claude', () => {
      const paths = resolveInstallPaths('global', homeDir, cwd);
      expect(paths.commandsDest).toBe(
        join(homeDir, '.claude', 'commands', 'clancy'),
      );
    });

    it('resolves workflows destination under ~/.claude', () => {
      const paths = resolveInstallPaths('global', homeDir, cwd);
      expect(paths.workflowsDest).toBe(
        join(homeDir, '.claude', 'clancy', 'workflows'),
      );
    });

    it('resolves claudeConfigDir to ~/.claude', () => {
      const paths = resolveInstallPaths('global', homeDir, cwd);
      expect(paths.claudeConfigDir).toBe(join(homeDir, '.claude'));
    });

    it('resolves manifest paths under ~/.claude/clancy', () => {
      const paths = resolveInstallPaths('global', homeDir, cwd);
      expect(paths.manifestPath).toBe(
        join(homeDir, '.claude', 'clancy', 'manifest.json'),
      );
      expect(paths.workflowsManifestPath).toBe(
        join(homeDir, '.claude', 'clancy', 'workflows-manifest.json'),
      );
    });

    it('resolves patches dir under ~/.claude/clancy', () => {
      const paths = resolveInstallPaths('global', homeDir, cwd);
      expect(paths.patchesDir).toBe(
        join(homeDir, '.claude', 'clancy', 'local-patches'),
      );
    });
  });

  describe('local mode', () => {
    it('resolves commands destination under cwd/.claude', () => {
      const paths = resolveInstallPaths('local', homeDir, cwd);
      expect(paths.commandsDest).toBe(
        join(cwd, '.claude', 'commands', 'clancy'),
      );
    });

    it('resolves workflows destination under cwd/.claude', () => {
      const paths = resolveInstallPaths('local', homeDir, cwd);
      expect(paths.workflowsDest).toBe(
        join(cwd, '.claude', 'clancy', 'workflows'),
      );
    });

    it('resolves claudeConfigDir to cwd/.claude', () => {
      const paths = resolveInstallPaths('local', homeDir, cwd);
      expect(paths.claudeConfigDir).toBe(join(cwd, '.claude'));
    });
  });

  it('always resolves clancyProjectDir to cwd/.clancy', () => {
    const global = resolveInstallPaths('global', homeDir, cwd);
    const local = resolveInstallPaths('local', homeDir, cwd);
    const expected = join(cwd, '.clancy');

    expect(global.clancyProjectDir).toBe(expected);
    expect(local.clancyProjectDir).toBe(expected);
  });
});

describe('parseEnabledRoles', () => {
  const noopFs = {
    readFile: () => {
      throw new Error('ENOENT');
    },
  };

  it('returns null when no .clancy/.env exists (first install)', () => {
    expect(parseEnabledRoles('/project', noopFs)).toBeNull();
  });

  it('returns empty set when .env exists but CLANCY_ROLES is unset', () => {
    const fs = {
      exists: () => true,
      readFile: () => 'OTHER_VAR=foo\n',
    };

    const result = parseEnabledRoles('/project', fs);
    expect(result).toEqual(new Set());
  });

  it('returns empty set when CLANCY_ROLES is empty', () => {
    const fs = {
      exists: () => true,
      readFile: () => 'CLANCY_ROLES=\n',
    };

    const result = parseEnabledRoles('/project', fs);
    expect(result).toEqual(new Set());
  });

  it('parses comma-separated role names', () => {
    const fs = {
      exists: () => true,
      readFile: () => 'CLANCY_ROLES=strategist,planner\n',
    };

    const result = parseEnabledRoles('/project', fs);
    expect(result).toEqual(new Set(['strategist', 'planner']));
  });

  it('trims whitespace and lowercases role names', () => {
    const fs = {
      exists: () => true,
      readFile: () => 'CLANCY_ROLES= Strategist , PLANNER \n',
    };

    const result = parseEnabledRoles('/project', fs);
    expect(result).toEqual(new Set(['strategist', 'planner']));
  });

  it('filters out empty segments from trailing commas', () => {
    const fs = {
      exists: () => true,
      readFile: () => 'CLANCY_ROLES=strategist,,planner,\n',
    };

    const result = parseEnabledRoles('/project', fs);
    expect(result).toEqual(new Set(['strategist', 'planner']));
  });
});

describe('validateSources', () => {
  const sources = {
    rolesDir: '/pkg/src/roles',
    hooksDir: '/pkg/hooks',
    bundleDir: '/pkg/bundle',
    agentsDir: '/pkg/src/agents',
  };

  it('does not throw when all sources exist', () => {
    const exists = () => true;
    expect(() => validateSources(sources, exists)).not.toThrow();
  });

  it('throws when roles directory is missing', () => {
    const exists = (p: string) => !p.includes('roles');
    expect(() => validateSources(sources, exists)).toThrow(/Roles.*not found/);
  });

  it('throws when bundle directory is missing', () => {
    const exists = (p: string) => !p.includes('bundle');
    expect(() => validateSources(sources, exists)).toThrow(
      /Runtime bundles.*not found/,
    );
  });

  it('throws when hooks directory is missing', () => {
    const exists = (p: string) => !p.includes('hooks');
    expect(() => validateSources(sources, exists)).toThrow(/Hooks.*not found/);
  });

  it('throws when a bundle script is missing', () => {
    const exists = (p: string) => !p.endsWith('clancy-implement.js');
    expect(() => validateSources(sources, exists)).toThrow(
      /clancy-implement\.js.*not found/,
    );
  });
});
