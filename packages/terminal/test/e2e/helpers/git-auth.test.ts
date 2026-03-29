import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import {
  cleanupGitAuth,
  configureGitAuth,
  createGitAskpass,
} from './git-auth.js';

describe('createGitAskpass', () => {
  afterEach(() => {
    cleanupGitAuth();
  });

  it('creates an executable askpass script', () => {
    const path = createGitAskpass('ghp_test123');

    expect(existsSync(path)).toBe(true);

    const stat = statSync(path);
    // Owner read + execute (0o500)
    const ownerBits = (stat.mode & 0o700) >> 6;
    expect(ownerBits).toBe(5); // r-x
  });

  it('stores the token in a separate file with restricted permissions', () => {
    const askpassPath = createGitAskpass('ghp_secret');
    const tokenPath = askpassPath.replace('askpass.sh', 'token');

    expect(readFileSync(tokenPath, 'utf8')).toBe('ghp_secret');

    const stat = statSync(tokenPath);
    const ownerBits = (stat.mode & 0o700) >> 6;
    expect(ownerBits).toBe(6); // rw-
  });

  it('returns x-access-token for username prompts', () => {
    const path = createGitAskpass('ghp_test');

    const result = execSync(`"${path}" "Username for 'https://github.com':"`, {
      encoding: 'utf8',
      shell: '/bin/sh',
    }).trim();

    expect(result).toBe('x-access-token');
  });

  it('returns the token for password prompts', () => {
    const path = createGitAskpass('ghp_my_token');

    const result = execSync(`"${path}" "Password for 'https://github.com':"`, {
      encoding: 'utf8',
      shell: '/bin/sh',
    }).trim();

    expect(result).toBe('ghp_my_token');
  });

  it('cleans up on subsequent calls', () => {
    const first = createGitAskpass('token1');
    const firstDir = first.replace('/askpass.sh', '');

    createGitAskpass('token2');

    expect(existsSync(firstDir)).toBe(false);
  });
});

describe('cleanupGitAuth', () => {
  it('removes the auth directory', () => {
    const path = createGitAskpass('ghp_test');
    const dir = path.replace('/askpass.sh', '');

    expect(existsSync(dir)).toBe(true);

    cleanupGitAuth();

    expect(existsSync(dir)).toBe(false);
  });

  it('is safe to call when no auth exists', () => {
    expect(() => cleanupGitAuth()).not.toThrow();
  });
});

describe('configureGitAuth', () => {
  afterEach(() => {
    cleanupGitAuth();
  });

  it('sets GIT_ASKPASS and GIT_TERMINAL_PROMPT', () => {
    configureGitAuth('ghp_test');

    expect(process.env.GIT_ASKPASS).toBeDefined();
    expect(existsSync(process.env.GIT_ASKPASS!)).toBe(true);
    expect(process.env.GIT_TERMINAL_PROMPT).toBe('0');
  });

  it('restores original env values on cleanup', () => {
    // Set originals before configuring auth
    process.env.GIT_ASKPASS = '/usr/bin/original';
    process.env.GIT_TERMINAL_PROMPT = '1';

    configureGitAuth('ghp_test');
    expect(process.env.GIT_ASKPASS).not.toBe('/usr/bin/original');

    // cleanupGitAuth in afterEach will restore — assert after it runs
    // So we verify inline: call cleanup explicitly and check restore
    cleanupGitAuth();
    expect(process.env.GIT_ASKPASS).toBe('/usr/bin/original');
    expect(process.env.GIT_TERMINAL_PROMPT).toBe('1');
  });

  it('deletes env vars when no originals existed', () => {
    delete process.env.GIT_ASKPASS;
    delete process.env.GIT_TERMINAL_PROMPT;

    configureGitAuth('ghp_test');

    expect(process.env.GIT_ASKPASS).toBeDefined();

    cleanupGitAuth();

    expect(process.env.GIT_ASKPASS).toBeUndefined();
    expect(process.env.GIT_TERMINAL_PROMPT).toBeUndefined();
  });
});
