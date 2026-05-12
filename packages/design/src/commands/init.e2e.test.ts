/**
 * E2E spawn test for `clancy:design init` — Phase F slice 9 spec cell:
 * "E2E: provide canned answers; assert DESIGN.md content."
 *
 * Spawns the package's bin script as a child process against a temp project
 * root, pipes 6 canned answers to stdin (matching the grill order), and
 * asserts:
 * - exit code 0
 * - both DESIGN.md + PRODUCT.md land at `.clancy/docs/`
 * - PRODUCT.md carries each grill answer in its named section
 * - stdout contains the progress lines the runtime handler emits
 *
 * Build dependency: same as slice 8 — bin script dynamically imports from
 * `../dist/commands/init.js`. Turbo's `test: { dependsOn: ['^build', 'build'] }`
 * (root `turbo.json`) ensures dist/ exists before the test runs.
 *
 * Stdin protocol: 6 newline-separated lines map 1:1 to the 6 prompts in the
 * order askGrill() asks them — Q1 audience (ask) / Q2 brand voice (ask) /
 * Q3 aesthetic (select; pass index) / Q4 scale family (select) / Q5 theme
 * (select) / Q6 anti-references (ask).
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

const spawnBinWithStdin = (
  args: readonly string[],
  cwd: string,
  stdinPayload: string,
): Promise<SpawnResult> =>
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
    child.stdin.write(stdinPayload);
    child.stdin.end();
  });

describe('bin/design.js init (E2E)', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'clancy-design-e2e-init-'));
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('routes `init`, walks the 6-question grill via stdin, writes both docs, exits 0', async () => {
    // 6 lines map to the 6 grill prompts in askGrill() order.
    // Selects answer by 1-based numeric index against the option list.
    const stdinPayload =
      [
        'beginner web developers', // Q1 audience (ask)
        'concise + technical', // Q2 brand voice (ask)
        '1', // Q3 aesthetic — index 1 → 'brutally minimal'
        '1', // Q4 scale family — index 1 → 'single product'
        '2', // Q5 theme — index 2 → 'dark'
        'no skeuomorphism', // Q6 anti-references (ask)
      ].join('\n') + '\n';

    const result = await spawnBinWithStdin(['init'], projectRoot, stdinPayload);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).not.toMatch(/Error/i);
    expect(result.stdout).toContain('.clancy/docs/DESIGN.md');
    expect(result.stdout).toContain('.clancy/docs/PRODUCT.md');

    const productMd = await readFile(
      join(projectRoot, '.clancy', 'docs', 'PRODUCT.md'),
      'utf8',
    );
    // All 6 grill answers reflected in PRODUCT.md sections — verifies
    // stdin → readline → askGrill → buildProductMd → writeFile chain
    // end-to-end (the integration slice 9 ships).
    expect(productMd).toContain('## Audience');
    expect(productMd).toContain('beginner web developers');
    expect(productMd).toContain('## Brand Voice');
    expect(productMd).toContain('concise + technical');
    expect(productMd).toContain('## Aesthetic Direction');
    expect(productMd).toContain('brutally minimal');
    expect(productMd).toContain('## Scale & Context');
    expect(productMd).toContain('single product');
    expect(productMd).toContain('## Theme');
    expect(productMd).toContain('dark');
    expect(productMd).toContain('## Anti-references');
    expect(productMd).toContain('no skeuomorphism');

    const designMd = await readFile(
      join(projectRoot, '.clancy', 'docs', 'DESIGN.md'),
      'utf8',
    );
    expect(designMd).toMatch(/^# DESIGN/m);
    expect(designMd).toContain('## Visual Theme & Atmosphere');
  });

  it('re-prompts on invalid select input then recovers (DA M2 fold — exercises select recursion)', async () => {
    // First aesthetic answer is invalid ("99" — out of range), then "abc"
    // (non-numeric), then valid "1". select() should re-prompt twice
    // before accepting. All subsequent answers valid.
    const stdinPayload =
      [
        'beginner web developers', // Q1 ask
        'concise + technical', // Q2 ask
        '99', // Q3 select — out of range
        'abc', // Q3 select — non-numeric (DA L3 fold: strict digits-only)
        '1', // Q3 select — valid → 'brutally minimal'
        '1', // Q4 select
        '2', // Q5 select
        'no skeuomorphism', // Q6 ask
      ].join('\n') + '\n';

    const result = await spawnBinWithStdin(['init'], projectRoot, stdinPayload);

    expect(result.exitCode).toBe(0);
    // Re-prompt messages emitted twice (once per invalid response).
    const invalidChoiceMatches =
      result.stdout.match(/Invalid choice\./g)?.length ?? 0;
    expect(invalidChoiceMatches).toBe(2);

    const productMd = await readFile(
      join(projectRoot, '.clancy', 'docs', 'PRODUCT.md'),
      'utf8',
    );
    expect(productMd).toContain('brutally minimal');
  });

  it('exits non-zero with a clear error when stdin closes mid-grill (DA M1 fold — EOF guard)', async () => {
    // Only 2 answers piped before EOF — the 3rd prompt (aesthetic select)
    // calls nextLine() which returns null; requireLine() throws; the error
    // bubbles to bin's main().catch and exits non-zero. Without the guard
    // this would hang the process (unbounded microtask recursion).
    const stdinPayload =
      ['beginner web developers', 'concise + technical'].join('\n') + '\n';

    const result = await spawnBinWithStdin(['init'], projectRoot, stdinPayload);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('stdin closed mid-grill');
  });
});
