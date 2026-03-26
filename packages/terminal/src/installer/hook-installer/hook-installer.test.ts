import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { installHooks } from './hook-installer.js';

/** The 8 compiled hook files Clancy ships. */
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

describe('installHooks', () => {
  let tmp: string;
  let hooksSource: string;
  let claudeDir: string;

  beforeEach(() => {
    tmp = join(tmpdir(), `clancy-test-${Date.now()}-${crypto.randomUUID()}`);
    hooksSource = join(tmp, 'hooks-src');
    claudeDir = join(tmp, '.claude');
    mkdirSync(hooksSource, { recursive: true });
    mkdirSync(claudeDir, { recursive: true });

    HOOK_FILES.forEach((f) => {
      writeFileSync(join(hooksSource, f), `// ${f}`);
    });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('copies hook files to the hooks directory', () => {
    installHooks({ claudeConfigDir: claudeDir, hooksSourceDir: hooksSource });

    const hooksDir = join(claudeDir, 'hooks');
    expect(existsSync(join(hooksDir, 'clancy-check-update.js'))).toBe(true);
    expect(existsSync(join(hooksDir, 'clancy-credential-guard.js'))).toBe(true);
  });

  it('writes a CommonJS package.json in the hooks directory', () => {
    installHooks({ claudeConfigDir: claudeDir, hooksSourceDir: hooksSource });

    const pkg = JSON.parse(
      readFileSync(join(claudeDir, 'hooks', 'package.json'), 'utf8'),
    ) as { type: string };
    expect(pkg.type).toBe('commonjs');
  });

  it('registers hooks in settings.json', () => {
    installHooks({ claudeConfigDir: claudeDir, hooksSourceDir: hooksSource });

    const settings = JSON.parse(
      readFileSync(join(claudeDir, 'settings.json'), 'utf8'),
    ) as Record<string, unknown>;
    const hooks = settings.hooks as Record<string, unknown[]>;

    expect(hooks.SessionStart).toHaveLength(1);
    expect(hooks.PostToolUse).toHaveLength(2);
    expect(hooks.PreToolUse).toHaveLength(2);
    expect(hooks.PostCompact).toHaveLength(1);
    expect(hooks.Notification).toHaveLength(1);
    expect(settings.statusLine).toBeDefined();
    expect((settings.statusLine as { type: string }).type).toBe('command');
  });

  it('does not duplicate hooks on re-install', () => {
    installHooks({ claudeConfigDir: claudeDir, hooksSourceDir: hooksSource });
    installHooks({ claudeConfigDir: claudeDir, hooksSourceDir: hooksSource });

    const settings = JSON.parse(
      readFileSync(join(claudeDir, 'settings.json'), 'utf8'),
    ) as Record<string, unknown>;
    const hooks = settings.hooks as Record<string, unknown[]>;

    expect(hooks.SessionStart).toHaveLength(1);
    expect(hooks.PostToolUse).toHaveLength(2);
    expect(hooks.PreToolUse).toHaveLength(2);
    expect(hooks.PostCompact).toHaveLength(1);
  });

  it('preserves existing settings', () => {
    writeFileSync(
      join(claudeDir, 'settings.json'),
      JSON.stringify({ customSetting: true }, null, 2),
    );

    installHooks({ claudeConfigDir: claudeDir, hooksSourceDir: hooksSource });

    const settings = JSON.parse(
      readFileSync(join(claudeDir, 'settings.json'), 'utf8'),
    ) as Record<string, unknown>;

    expect(settings.customSetting).toBe(true);
    expect(settings.hooks).toBeDefined();
  });

  it('updates statusLine to the current hooks path on reinstall', () => {
    const staleStatusLine = {
      type: 'command',
      command: 'node "/old/path/clancy-statusline.js"',
    };
    writeFileSync(
      join(claudeDir, 'settings.json'),
      JSON.stringify({ statusLine: staleStatusLine }, null, 2),
    );

    installHooks({ claudeConfigDir: claudeDir, hooksSourceDir: hooksSource });

    const settings = JSON.parse(
      readFileSync(join(claudeDir, 'settings.json'), 'utf8'),
    ) as Record<string, unknown>;
    const statusLine = settings.statusLine as { command: string };

    expect(statusLine.command).toContain('clancy-statusline.js');
    expect(statusLine.command).not.toContain('/old/path/');
  });

  it('returns true on success', () => {
    const result = installHooks({
      claudeConfigDir: claudeDir,
      hooksSourceDir: hooksSource,
    });
    expect(result).toBe(true);
  });

  it('registers the verification gate agent hook when prompt is provided', () => {
    installHooks({
      claudeConfigDir: claudeDir,
      hooksSourceDir: hooksSource,
      verificationGatePrompt: '# Verification Gate Agent\n\nYou are the gate.',
    });

    const settings = JSON.parse(
      readFileSync(join(claudeDir, 'settings.json'), 'utf8'),
    ) as Record<string, unknown>;
    const hooks = settings.hooks as Record<
      string,
      { hooks: { type: string; prompt?: string; timeout?: number }[] }[]
    >;

    expect(hooks.Stop).toHaveLength(1);
    expect(hooks.Stop[0].hooks[0].type).toBe('agent');
    expect(hooks.Stop[0].hooks[0].prompt).toContain('Verification Gate Agent');
    expect(hooks.Stop[0].hooks[0].timeout).toBe(120);
  });

  it('does not register Stop hook when no prompt is provided', () => {
    installHooks({ claudeConfigDir: claudeDir, hooksSourceDir: hooksSource });

    const settings = JSON.parse(
      readFileSync(join(claudeDir, 'settings.json'), 'utf8'),
    ) as Record<string, unknown>;
    const hooks = settings.hooks as Record<string, unknown>;

    expect(hooks.Stop).toBeUndefined();
  });

  it('does not duplicate the agent hook on re-install', () => {
    const opts = {
      claudeConfigDir: claudeDir,
      hooksSourceDir: hooksSource,
      verificationGatePrompt: '# Verification Gate Agent\n\nYou are the gate.',
    };
    installHooks(opts);
    installHooks(opts);

    const settings = JSON.parse(
      readFileSync(join(claudeDir, 'settings.json'), 'utf8'),
    ) as Record<string, unknown>;
    const hooks = settings.hooks as Record<string, unknown[]>;

    expect(hooks.Stop).toHaveLength(1);
  });

  it('handles malformed existing settings gracefully', () => {
    writeFileSync(
      join(claudeDir, 'settings.json'),
      JSON.stringify({ hooks: 'not-an-object', statusLine: 42 }, null, 2),
    );

    const result = installHooks({
      claudeConfigDir: claudeDir,
      hooksSourceDir: hooksSource,
    });

    expect(result).toBe(true);

    const settings = JSON.parse(
      readFileSync(join(claudeDir, 'settings.json'), 'utf8'),
    ) as Record<string, unknown>;
    const hooks = settings.hooks as Record<string, unknown[]>;

    expect(hooks.SessionStart).toHaveLength(1);
    expect(hooks.PostToolUse).toHaveLength(2);
    expect(hooks.PreToolUse).toHaveLength(2);
    expect(hooks.PostCompact).toHaveLength(1);
    expect(hooks.Notification).toHaveLength(1);
    // Malformed statusLine is overwritten with the correct command
    expect((settings.statusLine as { type: string }).type).toBe('command');
  });

  it('handles malformed hook event arrays gracefully', () => {
    writeFileSync(
      join(claudeDir, 'settings.json'),
      JSON.stringify(
        {
          hooks: {
            SessionStart: ['bad'],
            PreToolUse: [{ hooks: 'not-an-array' }],
          },
        },
        null,
        2,
      ),
    );

    const result = installHooks({
      claudeConfigDir: claudeDir,
      hooksSourceDir: hooksSource,
    });

    expect(result).toBe(true);

    const settings = JSON.parse(
      readFileSync(join(claudeDir, 'settings.json'), 'utf8'),
    ) as Record<string, unknown>;
    const hooks = settings.hooks as Record<string, unknown[]>;

    expect(hooks.SessionStart).toHaveLength(1);
    expect(hooks.PostToolUse).toHaveLength(2);
    expect(hooks.PreToolUse).toHaveLength(2);
    expect(hooks.PostCompact).toHaveLength(1);
    expect(hooks.Notification).toHaveLength(1);
  });

  it('returns false when source hooks are missing', () => {
    const result = installHooks({
      claudeConfigDir: claudeDir,
      hooksSourceDir: join(tmp, 'nonexistent'),
    });
    expect(result).toBe(false);
  });
});
