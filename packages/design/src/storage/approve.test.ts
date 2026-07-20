import type { Variant } from '../generate/types.js';

import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { approveVariant } from './approve.js';

const variant: Variant = {
  id: 'v2-iter5',
  seed: 'brutally minimal',
  html: '<button>Submit</button>',
  rationale: 'Reduced visual noise per comment feedback.',
};

describe('approval marker persistence', () => {
  let sessionDir: string;

  beforeEach(async () => {
    sessionDir = await mkdtemp(join(tmpdir(), 'clancy-design-approve-'));
  });

  afterEach(async () => {
    await rm(sessionDir, { recursive: true, force: true });
  });

  it('writes a marker file with variantId, sessionId, approvedAt, sha256, and approverPid', async () => {
    await approveVariant(sessionDir, variant, {
      sessionId: 'sess_abc123',
      now: new Date('2026-05-04T14:23:11.000Z'),
      pid: 12345,
    });

    const raw = await readFile(join(sessionDir, 'v2-iter5.approved'), 'utf8');
    const marker: unknown = JSON.parse(raw);

    expect(marker).toEqual({
      variantId: 'v2-iter5',
      sessionId: 'sess_abc123',
      approvedAt: '2026-05-04T14:23:11.000Z',
      sha256: createHash('sha256').update(variant.html).digest('hex'),
      approverPid: 12345,
    });
  });
});
