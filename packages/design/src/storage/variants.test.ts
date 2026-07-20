import type { Variant } from '../generate/types.js';

import { appendFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { appendVariant, readVariants } from './variants.js';

const makeVariant = (id: string, seed: string): Variant => ({
  id,
  seed,
  html: `<button>${id}</button>`,
  rationale: `Rationale for ${id}.`,
});

describe('JSONL variant persistence', () => {
  let sessionDir: string;

  beforeEach(async () => {
    sessionDir = await mkdtemp(join(tmpdir(), 'clancy-design-variants-'));
  });

  afterEach(async () => {
    await rm(sessionDir, { recursive: true, force: true });
  });

  it('writes 3 variants and reads them back in order', async () => {
    const first = makeVariant('v1-iter1', 'brutally minimal');
    const second = makeVariant('v2-iter1', 'editorial/magazine');
    const third = makeVariant('v3-iter1', 'brutalist/raw');

    await appendVariant(sessionDir, first);
    await appendVariant(sessionDir, second);
    await appendVariant(sessionDir, third);

    expect(await readVariants(sessionDir)).toEqual([first, second, third]);
  });

  it('returns an empty list when no variants file exists yet', async () => {
    expect(await readVariants(sessionDir)).toEqual([]);
  });

  it('skips a truncated last line left by a crash mid-append', async () => {
    const first = makeVariant('v1-iter1', 'brutally minimal');
    await appendVariant(sessionDir, first);

    await appendFile(
      join(sessionDir, 'variants.jsonl'),
      '{"id":"v2-iter1","seed":"editorial/magazine","html"',
      'utf8',
    );

    expect(await readVariants(sessionDir)).toEqual([first]);
  });
});
