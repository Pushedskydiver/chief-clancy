import type { Prompter } from './init.js';

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runInit } from './init.js';

describe('runInit', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'clancy-design-cmd-init-'));
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('runs the 6-question grill and writes DESIGN.md + PRODUCT.md with the answers', async () => {
    // Order-coupled queue: tests pin the grill order (Q1..Q6) — user-facing
    // contract per spec L847 + slice-9 Q6 anti-references addition.
    const answersQueue: string[] = [
      'beginner web developers', // Q1 audience (ask)
      'concise + technical', // Q2 brand voice (ask)
      'brutally minimal', // Q3 aesthetic (select from Anthropic taxonomy)
      'single product', // Q4 scale family (select)
      'dark', // Q5 theme (select)
      'no skeuomorphism', // Q6 anti-references (ask)
    ];
    const prompter: Prompter = {
      ask: async () => answersQueue.shift() ?? '',
      select: async (_prompt, options) => {
        const answer = answersQueue.shift() ?? '';
        if (!options.includes(answer)) {
          throw new Error(
            `Canned answer "${answer}" missing from select options [${options.join(', ')}]`,
          );
        }
        return answer;
      },
    };
    const logs: string[] = [];

    const result = await runInit(projectRoot, {
      prompter,
      logger: (line) => logs.push(line),
    });

    expect(result.exitCode).toBe(0);
    expect(result.designMdPath).toBe(
      join(projectRoot, '.clancy', 'docs', 'DESIGN.md'),
    );
    expect(result.productMdPath).toBe(
      join(projectRoot, '.clancy', 'docs', 'PRODUCT.md'),
    );

    // PRODUCT.md: 6 sections, each containing the corresponding grill answer.
    // State-based assertion per TESTING.md §Test state, not interactions —
    // the file content IS the observable contract.
    const productMd = await readFile(result.productMdPath, 'utf8');
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

    // DESIGN.md: greenfield starter scaffold (placeholder for slice 11+ to
    // populate). Loose assertions: top-level header present + scaffolding
    // marker visible.
    const designMd = await readFile(result.designMdPath, 'utf8');
    expect(designMd).toMatch(/^# DESIGN/m);

    // Confirm the prompter consumed all 6 canned answers — guards against
    // an implementation that asks fewer (or more) than 6 questions.
    expect(answersQueue).toHaveLength(0);

    // CLI affordance: per-file write confirmations (interaction assertion is
    // appropriate here per TESTING.md §Test state, not interactions carve-out
    // — "side-effect ordering" + "file copy counts" both apply).
    const joined = logs.join('\n');
    expect(joined).toContain('.clancy/docs/DESIGN.md');
    expect(joined).toContain('.clancy/docs/PRODUCT.md');
  });
});
