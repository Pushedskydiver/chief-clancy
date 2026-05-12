import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runDocument } from './document.js';

describe('runDocument', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'clancy-design-cmd-document-'));
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('runs the slice 7 writer and logs progress lines naming both output paths', async () => {
    const logs: string[] = [];
    const result = await runDocument(projectRoot, {
      logger: (line) => logs.push(line),
    });

    expect(result.exitCode).toBe(0);
    expect(result.designJsonPath).toBe(
      join(projectRoot, '.clancy', 'docs', 'DESIGN.json'),
    );
    expect(result.designMdPath).toBe(
      join(projectRoot, '.clancy', 'docs', 'DESIGN.md'),
    );

    // Files written by the underlying slice 7 `document()` — spot-check both
    // exist + parse as expected, so the wiring (not just the return shape) is
    // exercised. Slice 7's own tests cover content correctness in detail.
    const jsonContent = await readFile(result.designJsonPath, 'utf8');
    expect(JSON.parse(jsonContent)).toMatchObject({ version: '0.1' });
    const mdContent = await readFile(result.designMdPath, 'utf8');
    expect(mdContent).toMatch(/^# DESIGN/m);

    // CLI affordance: the runtime handler must surface per-file write
    // confirmations so the user sees what landed. Slice 7's library surface
    // returns paths silently; slice 8 layers logging on top.
    const joined = logs.join('\n');
    expect(joined).toContain('.clancy/docs/DESIGN.json');
    expect(joined).toContain('.clancy/docs/DESIGN.md');
  });
});
