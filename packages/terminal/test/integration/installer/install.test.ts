/**
 * Integration tests for the installer orchestrator.
 *
 * Exercises the full runInstall pipeline against real temporary directories.
 * No mocking — all filesystem operations hit disk. Verifies that the
 * correct files are created, manifests are valid, backups work, and
 * the pipeline handles fresh installs and updates correctly.
 */
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  resolveInstallPaths,
  runInstall,
} from '~/t/installer/install/install.js';
import { hasErrorCode } from '~/t/installer/shared/fs-errors/index.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hook file names the hook-installer expects to find in hooksDir
// ---------------------------------------------------------------------------

const HOOK_FILES = [
  'clancy-check-update.js',
  'clancy-statusline.js',
  'clancy-context-monitor.js',
  'clancy-credential-guard.js',
  'clancy-branch-guard.js',
  'clancy-post-compact.js',
  'clancy-notification.js',
  'clancy-drift-detector.js',
];

const FIXED_TIME = '2026-01-01T00:00:00.000Z';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Real InstallerFs backed by node:fs. */
function createRealFs() {
  const rejectSymlink = (path: string): void => {
    try {
      if (lstatSync(path).isSymbolicLink()) {
        throw new Error(`${path} is a symlink.`);
      }
    } catch (err: unknown) {
      if (hasErrorCode(err, 'ENOENT')) return;
      throw err;
    }
  };

  return {
    exists: existsSync,
    readFile: (p: string) => readFileSync(p, 'utf8'),
    writeFile: (p: string, c: string) => writeFileSync(p, c),
    mkdir: (p: string) => mkdirSync(p, { recursive: true }),
    copyFile: copyFileSync,
    rejectSymlink,
  };
}

/** Stub prompts that auto-accept or auto-decline. */
function createStubPrompts(answer = 'y') {
  return { ask: vi.fn(() => Promise.resolve(answer)) };
}

/** Create source fixture directories with minimal content. */
function createSourceFixtures(baseDir: string) {
  const rolesDir = join(baseDir, 'src', 'roles');
  const hooksDir = join(baseDir, 'hooks');
  const bundleDir = join(baseDir, 'bundle');
  const agentsDir = join(baseDir, 'src', 'agents');

  mkdirSync(join(rolesDir, 'implementer', 'commands'), { recursive: true });
  mkdirSync(join(rolesDir, 'implementer', 'workflows'), { recursive: true });
  mkdirSync(join(rolesDir, 'strategist', 'commands'), { recursive: true });

  writeFileSync(
    join(rolesDir, 'implementer', 'commands', 'run.md'),
    '# /clancy:run\nRun Clancy.',
  );
  writeFileSync(
    join(rolesDir, 'implementer', 'workflows', 'deploy.md'),
    '# Deploy workflow',
  );
  writeFileSync(
    join(rolesDir, 'strategist', 'commands', 'brief.md'),
    '# /clancy:brief\n@.claude/clancy/workflows/deploy.md',
  );

  mkdirSync(hooksDir, { recursive: true });
  HOOK_FILES.forEach((f) => writeFileSync(join(hooksDir, f), `// ${f}`));

  mkdirSync(bundleDir, { recursive: true });
  writeFileSync(join(bundleDir, 'clancy-once.js'), '// once');
  writeFileSync(join(bundleDir, 'clancy-afk.js'), '// afk');

  mkdirSync(agentsDir, { recursive: true });
  writeFileSync(
    join(agentsDir, 'verification-gate.md'),
    '# Verification gate prompt',
  );

  return { rolesDir, hooksDir, bundleDir, agentsDir };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let testDir: string;

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'clancy-install-integration-'));
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('runInstall — integration', () => {
  describe('fresh local install', () => {
    let paths: ReturnType<typeof resolveInstallPaths>;

    beforeEach(async () => {
      const sources = createSourceFixtures(join(testDir, 'pkg'));
      paths = resolveInstallPaths('local', testDir, testDir);

      await runInstall({
        mode: 'local',
        paths,
        sources,
        version: '1.0.0',
        nonInteractive: true,
        prompts: createStubPrompts(),
        fs: createRealFs(),
        cwd: testDir,
        now: () => FIXED_TIME,
      });
    });

    it('creates commands and workflows in .claude/', () => {
      expect(existsSync(join(paths.commandsDest, 'run.md'))).toBe(true);
      expect(existsSync(join(paths.commandsDest, 'brief.md'))).toBe(true);
      expect(existsSync(join(paths.workflowsDest, 'deploy.md'))).toBe(true);
    });

    it('writes VERSION file', () => {
      const version = readFileSync(join(paths.commandsDest, 'VERSION'), 'utf8');
      expect(version).toBe('1.0.0');
    });

    it('writes valid manifest JSON with SHA-256 hashes', () => {
      const cmdManifest = JSON.parse(
        readFileSync(paths.manifestPath, 'utf8'),
      ) as Record<string, string>;

      expect(Object.keys(cmdManifest).length).toBeGreaterThan(0);

      const hashPattern = /^[a-f0-9]{64}$/;
      Object.values(cmdManifest).forEach((hash) => {
        expect(hash).toMatch(hashPattern);
      });
    });

    it('copies bundle scripts to .clancy/', () => {
      expect(existsSync(join(paths.clancyProjectDir, 'clancy-once.js'))).toBe(
        true,
      );
      expect(existsSync(join(paths.clancyProjectDir, 'clancy-afk.js'))).toBe(
        true,
      );
    });

    it('writes version.json with injected timestamp', () => {
      const versionJson = JSON.parse(
        readFileSync(join(paths.clancyProjectDir, 'version.json'), 'utf8'),
      ) as { version: string; installedAt: string };

      expect(versionJson.version).toBe('1.0.0');
      expect(versionJson.installedAt).toBe(FIXED_TIME);
    });

    it('writes ESM package.json to .clancy/', () => {
      const pkgJson = JSON.parse(
        readFileSync(join(paths.clancyProjectDir, 'package.json'), 'utf8'),
      ) as { type: string };

      expect(pkgJson.type).toBe('module');
    });

    it('registers hooks in settings.json', () => {
      const settingsPath = join(paths.claudeConfigDir, 'settings.json');
      expect(existsSync(settingsPath)).toBe(true);

      const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
        hooks: Record<string, unknown>;
      };
      expect(settings.hooks).toBeDefined();
      expect(settings.hooks.PreToolUse).toBeDefined();
    });
  });

  describe('fresh global install', () => {
    it('inlines workflow references in command files', async () => {
      const sources = createSourceFixtures(join(testDir, 'pkg'));
      const homeDir = join(testDir, 'home');
      mkdirSync(homeDir, { recursive: true });
      const paths = resolveInstallPaths('global', homeDir, testDir);

      await runInstall({
        mode: 'global',
        paths,
        sources,
        version: '1.0.0',
        nonInteractive: true,
        prompts: createStubPrompts(),
        fs: createRealFs(),
        cwd: testDir,
        now: () => FIXED_TIME,
      });

      const briefContent = readFileSync(
        join(paths.commandsDest, 'brief.md'),
        'utf8',
      );

      expect(briefContent).not.toContain('@.claude/clancy/workflows/');
      expect(briefContent).toContain('# Deploy workflow');
    });
  });

  describe('update path', () => {
    it('detects and backs up modified files', async () => {
      const sources = createSourceFixtures(join(testDir, 'pkg'));
      const paths = resolveInstallPaths('local', testDir, testDir);
      const options = {
        mode: 'local' as const,
        paths,
        sources,
        version: '1.0.0',
        nonInteractive: true,
        prompts: createStubPrompts(),
        fs: createRealFs(),
        cwd: testDir,
        now: () => FIXED_TIME,
      };

      await runInstall(options);
      writeFileSync(join(paths.commandsDest, 'run.md'), '# Modified by user');
      await runInstall(options);

      const metaPath = join(paths.patchesDir, 'backup-meta.json');
      expect(existsSync(metaPath)).toBe(true);

      const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as {
        backed_up: readonly string[];
      };
      expect(meta.backed_up).toContain('run.md');
    });

    it('overwrites files with fresh source content after backup', async () => {
      const sources = createSourceFixtures(join(testDir, 'pkg'));
      const paths = resolveInstallPaths('local', testDir, testDir);
      const options = {
        mode: 'local' as const,
        paths,
        sources,
        version: '1.0.0',
        nonInteractive: true,
        prompts: createStubPrompts(),
        fs: createRealFs(),
        cwd: testDir,
        now: () => FIXED_TIME,
      };

      await runInstall(options);
      writeFileSync(join(paths.commandsDest, 'run.md'), '# Modified by user');
      await runInstall(options);

      const content = readFileSync(join(paths.commandsDest, 'run.md'), 'utf8');
      expect(content).toBe('# /clancy:run\nRun Clancy.');
    });

    it('is idempotent — running twice produces the same state', async () => {
      const sources = createSourceFixtures(join(testDir, 'pkg'));
      const paths = resolveInstallPaths('local', testDir, testDir);
      const options = {
        mode: 'local' as const,
        paths,
        sources,
        version: '1.0.0',
        nonInteractive: true,
        prompts: createStubPrompts(),
        fs: createRealFs(),
        cwd: testDir,
        now: () => FIXED_TIME,
      };

      await runInstall(options);
      const manifestFirst = readFileSync(paths.manifestPath, 'utf8');

      await runInstall(options);
      const manifestSecond = readFileSync(paths.manifestPath, 'utf8');

      expect(manifestFirst).toBe(manifestSecond);
    });
  });

  describe('abort path', () => {
    it('does not write files when user declines overwrite', async () => {
      const sources = createSourceFixtures(join(testDir, 'pkg'));
      const paths = resolveInstallPaths('local', testDir, testDir);
      const realFs = createRealFs();

      await runInstall({
        mode: 'local',
        paths,
        sources,
        version: '1.0.0',
        nonInteractive: true,
        prompts: createStubPrompts(),
        fs: realFs,
        cwd: testDir,
        now: () => FIXED_TIME,
      });

      writeFileSync(join(paths.commandsDest, 'run.md'), '# Modified by user');

      await runInstall({
        mode: 'local',
        paths,
        sources,
        version: '2.0.0',
        nonInteractive: false,
        prompts: createStubPrompts('n'),
        fs: realFs,
        cwd: testDir,
        now: () => FIXED_TIME,
      });

      const content = readFileSync(join(paths.commandsDest, 'run.md'), 'utf8');
      expect(content).toBe('# Modified by user');

      const version = readFileSync(join(paths.commandsDest, 'VERSION'), 'utf8');
      expect(version).toBe('1.0.0');
    });
  });
});
