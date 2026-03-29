/**
 * Git authentication helper for E2E tests.
 *
 * Configures GIT_ASKPASS so that `git push` can authenticate using
 * the GitHub PAT from E2E credentials. The token is stored in a
 * private temp directory (created via mkdtempSync) to avoid symlink
 * attacks. Cleanup is registered on process exit.
 */
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Singleton state for process-level auth cleanup
let authDir: string | undefined;
let askpassPath: string | undefined;
let tokenPath: string | undefined;
let cleanupRegistered = false;
let envCaptured = false;
let originalAskpass: string | undefined;
let originalTerminalPrompt: string | undefined;

/**
 * Create a GIT_ASKPASS helper script that returns the given token.
 *
 * Both the token file and askpass script are placed inside a private
 * temp directory (0o700) created via mkdtempSync. The askpass script
 * inspects the prompt argument to distinguish between username and
 * password prompts — git calls GIT_ASKPASS for both.
 *
 * @param token - The GitHub PAT to use for authentication.
 * @returns The path to the askpass script.
 */
export function createGitAskpass(token: string): string {
  // Always recreate — token may differ between calls
  cleanupGitAuth();

  // Create a private temp directory (owner-only access)
  authDir = mkdtempSync(join(tmpdir(), 'clancy-e2e-auth-'));
  chmodSync(authDir, 0o700);

  tokenPath = join(authDir, 'token');
  askpassPath = join(authDir, 'askpass.sh');

  // Write token to a separate file (owner-read only)
  writeFileSync(tokenPath, token);
  chmodSync(tokenPath, 0o600);

  // Askpass script inspects the prompt to return the correct value.
  // Git calls GIT_ASKPASS with a prompt string like "Username for ..."
  // or "Password for ...". For GitHub HTTPS, the username is
  // "x-access-token" and the password is the PAT.
  // Single quotes around tokenPath prevent shell interpolation of $, `,
  // or " characters that could appear in tmpdir() paths on some systems.
  const script = [
    '#!/bin/sh',
    'prompt="$1"',
    'if echo "$prompt" | grep -qi "username"; then',
    '  printf "%s\\n" "x-access-token"',
    'else',
    `  cat '${tokenPath}'`,
    'fi',
    '',
  ].join('\n');

  writeFileSync(askpassPath, script);
  chmodSync(askpassPath, 0o500);

  // Register cleanup on process exit
  if (!cleanupRegistered) {
    cleanupRegistered = true;
    process.on('exit', cleanupGitAuth);
  }

  return askpassPath;
}

/**
 * Remove the auth directory and restore original env values.
 */
export function cleanupGitAuth(): void {
  if (authDir) {
    rmSync(authDir, { recursive: true, force: true });
    authDir = undefined;
    askpassPath = undefined;
    tokenPath = undefined;
  }

  if (envCaptured) {
    restoreEnv('GIT_ASKPASS', originalAskpass);
    restoreEnv('GIT_TERMINAL_PROMPT', originalTerminalPrompt);
    envCaptured = false;
    originalAskpass = undefined;
    originalTerminalPrompt = undefined;
  }
}

/** Restore or delete an env variable. */
function restoreEnv(key: string, original: string | undefined): void {
  if (original === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = original;
  }
}

/**
 * Configure process.env for git push authentication.
 *
 * Sets GIT_ASKPASS to a helper script that returns the token,
 * and GIT_TERMINAL_PROMPT=0 to prevent interactive prompts.
 *
 * @param token - The GitHub PAT to use for authentication.
 */
export function configureGitAuth(token: string): void {
  // Capture originals before createGitAskpass (which calls cleanupGitAuth)
  const prevAskpass = process.env.GIT_ASKPASS;
  const prevPrompt = process.env.GIT_TERMINAL_PROMPT;

  const scriptPath = createGitAskpass(token);

  // Store originals after createGitAskpass so cleanup doesn't clear them
  envCaptured = true;
  originalAskpass = prevAskpass;
  originalTerminalPrompt = prevPrompt;

  process.env.GIT_ASKPASS = scriptPath;
  process.env.GIT_TERMINAL_PROMPT = '0';
}
