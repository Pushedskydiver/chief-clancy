/**
 * E2E spawn test for `clancy:design document` — Phase F slice 8 spec cell:
 * "spawn CLI on fixture; assert output files."
 *
 * Spawns the package's bin script as a child process against a temp project
 * root. Asserts:
 * - exit code 0
 * - both DESIGN.json + DESIGN.md land at `.clancy/docs/`
 * - stdout contains the progress lines the runtime handler emits
 *
 * Build dependency: this test imports the bin script at the path it'll exist
 * post-`pnpm build` (the design package ships `bin/` + `dist/` together). The
 * bin script dynamically imports from `../dist/commands/document.js`. Turbo's
 * `test: { dependsOn: ['^build', 'build'] }` (see root `turbo.json`) ensures
 * dist/ exists before the test runs.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BIN_PATH = join(PACKAGE_ROOT, 'bin', 'design.js');

type SpawnResult = {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
};

const spawnBin = (args: readonly string[], cwd: string): Promise<SpawnResult> =>
  new Promise((resolve, reject) => {
    const child = spawn('node', [BIN_PATH, ...args], { cwd });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({
        exitCode,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
      });
    });
  });

describe('bin/design.js document (E2E)', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'clancy-design-e2e-document-'));
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('routes `document` subcommand, writes design docs, prints progress, exits 0', async () => {
    const result = await spawnBin(['document'], projectRoot);

    expect(result.exitCode).toBe(0);
    // Loosen from strict-equality to "no Error: line" — a future Node /
    // dependency emitting deprecation warnings to stderr shouldn't flake
    // this test (DA L3 fold).
    expect(result.stderr).not.toMatch(/Error/i);
    expect(result.stdout).toContain('.clancy/docs/DESIGN.json');
    expect(result.stdout).toContain('.clancy/docs/DESIGN.md');

    const jsonContent = await readFile(
      join(projectRoot, '.clancy', 'docs', 'DESIGN.json'),
      'utf8',
    );
    expect(JSON.parse(jsonContent)).toMatchObject({ version: '0.1' });

    const mdContent = await readFile(
      join(projectRoot, '.clancy', 'docs', 'DESIGN.md'),
      'utf8',
    );
    expect(mdContent).toMatch(/^# DESIGN/m);
  });

  it('exits non-zero on an unknown subcommand and names it in stderr (DA M1 fold)', async () => {
    const result = await spawnBin(['documemt'], projectRoot);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('Unknown subcommand: documemt');
  });
});
