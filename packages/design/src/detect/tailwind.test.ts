import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { detectTailwind } from './tailwind.js';

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'test',
  'fixtures',
);

describe('detectTailwind', () => {
  it('returns null when no tailwind.config.{js,cjs,mjs,ts} is present', async () => {
    const result = await detectTailwind(join(FIXTURES, 'empty'));
    expect(result).toBeNull();
  });

  it('extracts theme.extend.{colors,spacing,fontSize} from a CommonJS .js config', async () => {
    const result = await detectTailwind(join(FIXTURES, 'tailwind-basic'));
    expect(result).toEqual({
      colors: {
        brand: '#FF0080',
        'brand-soft': '#FFEEF6',
      },
      spacing: {
        128: '32rem',
      },
      fontSize: {
        mega: ['4rem', { lineHeight: '1.1' }],
      },
    });
  });

  it('extracts theme.extend.{colors,spacing,fontSize} from an ESM .mjs config', async () => {
    const result = await detectTailwind(join(FIXTURES, 'tailwind-mjs'));
    expect(result).toEqual({
      colors: { ink: '#101720' },
      spacing: { gutter: '1rem' },
      fontSize: { body: ['1rem', { lineHeight: '1.6' }] },
    });
  });

  it('extracts theme.extend.{colors,spacing,fontSize} from a TypeScript config', async () => {
    const result = await detectTailwind(join(FIXTURES, 'tailwind-ts'));
    expect(result).toEqual({
      colors: { accent: '#00B0FF' },
      spacing: { gutter: '1.25rem' },
      fontSize: { display: ['3rem', { lineHeight: '1.05' }] },
    });
  });

  it('returns empty records when theme is set but theme.extend is missing', async () => {
    // Locks the slice-2 contract: detection only reads theme.extend.*, not
    // top-level theme.*. Slice 6 schema may revisit; this test guards against
    // a future fold accidentally widening the read surface.
    const result = await detectTailwind(join(FIXTURES, 'tailwind-no-extend'));
    expect(result).toEqual({ colors: {}, spacing: {}, fontSize: {} });
  });

  it('returns empty records when theme is missing entirely', async () => {
    const result = await detectTailwind(join(FIXTURES, 'tailwind-no-theme'));
    expect(result).toEqual({ colors: {}, spacing: {}, fontSize: {} });
  });

  it('treats callback-form theme.extend.colors as empty record (slice-6 schema lifts this)', async () => {
    const result = await detectTailwind(
      join(FIXTURES, 'tailwind-function-colors'),
    );
    expect(result?.colors).toEqual({});
    expect(result?.spacing).toEqual({ 128: '32rem' });
  });

  it('returns null and warns when the config file throws during evaluation', async () => {
    // Synthesise a broken config inline to exercise the malformed-config
    // branch without committing a perpetually-broken fixture.
    const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'clancy-design-broken-'));
    writeFileSync(
      join(dir, 'tailwind.config.js'),
      'throw new Error("boom from config");\n',
    );
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await detectTailwind(dir);
      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0]?.[0]).toContain('boom from config');
    } finally {
      warnSpy.mockRestore();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
