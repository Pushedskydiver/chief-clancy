import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { detectCssVars } from './css-vars.js';

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'test',
  'fixtures',
);

describe('detectCssVars', () => {
  it('extracts CSS custom properties from a single :root block', async () => {
    const result = await detectCssVars(join(FIXTURES, 'css-vars-basic'));
    expect(result).toEqual({
      '--brand': '#ff0080',
      '--brand-soft': '#ffeef6',
      '--space-md': '1rem',
      '--font-body': "'Inter', system-ui, sans-serif",
    });
  });

  it('returns null when the project root contains no .css files', async () => {
    const result = await detectCssVars(join(FIXTURES, 'empty'));
    expect(result).toBeNull();
  });

  it('returns an empty record when a .css file contains no custom properties', async () => {
    // Distinct from no-files (null) — files exist but carry no design-token
    // signal. Callers should treat this as "stylesheet present, zero vars."
    const result = await detectCssVars(join(FIXTURES, 'css-vars-no-vars'));
    expect(result).toEqual({});
  });

  it('merges custom properties across multiple files at the same level', async () => {
    const result = await detectCssVars(join(FIXTURES, 'css-vars-multi-file'));
    expect(result).toEqual({
      '--radius-sm': '4px',
      '--radius-md': '8px',
      '--color-primary': '#0066ff',
      '--color-accent': '#ff9500',
    });
  });

  it('last-write-wins on duplicate var names within a file (e.g. :root vs .dark)', async () => {
    // Detector does not track selector scope; the .dark override is the last
    // value seen during scan and supersedes the :root value in the flat map.
    // Slice 6 schema may revisit if selector-aware tokens become load-bearing.
    const result = await detectCssVars(join(FIXTURES, 'css-vars-last-wins'));
    expect(result).toEqual({
      '--color-primary': '#66ccff',
      '--color-bg': '#0a0a0a',
    });
  });

  it('recursively descends into subdirectories', async () => {
    const result = await detectCssVars(join(FIXTURES, 'css-vars-nested'));
    expect(result).toEqual({
      '--btn-radius': '6px',
      '--btn-padding': '0.5rem 1rem',
    });
  });

  it('skips node_modules, dist, and other excluded directories', async () => {
    // Synthesised inline because root .gitignore excludes `node_modules/` and
    // `dist/` everywhere — committing the fixture as plain files would leave
    // CI with an empty tree and the test would falsely pass without exercising
    // the exclusion logic.
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } =
      await import('node:fs');
    const { tmpdir } = await import('node:os');
    const root = mkdtempSync(join(tmpdir(), 'clancy-design-exclude-'));
    mkdirSync(join(root, 'node_modules', 'some-pkg'), { recursive: true });
    mkdirSync(join(root, 'dist'), { recursive: true });
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(
      join(root, 'node_modules', 'some-pkg', 'styles.css'),
      ':root { --vendor-color: red; }\n',
    );
    writeFileSync(
      join(root, 'dist', 'bundle.css'),
      ':root { --built-color: blue; }\n',
    );
    writeFileSync(
      join(root, 'src', 'app.css'),
      ':root { --app-color: green; }\n',
    );
    try {
      const result = await detectCssVars(root);
      expect(result).toEqual({ '--app-color': 'green' });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns null and does not throw when the project root does not exist', async () => {
    const result = await detectCssVars(
      join(FIXTURES, 'css-vars-does-not-exist'),
    );
    expect(result).toBeNull();
  });

  it('warns and continues when a .css file cannot be read', async () => {
    const { mkdtempSync, writeFileSync, chmodSync, rmSync } =
      await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'clancy-design-css-vars-'));
    writeFileSync(join(dir, 'good.css'), ':root { --kept: red; }\n');
    const unreadable = join(dir, 'bad.css');
    writeFileSync(unreadable, ':root { --dropped: blue; }\n');
    chmodSync(unreadable, 0o000);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await detectCssVars(dir);
      expect(result).toEqual({ '--kept': 'red' });
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0]?.[0]).toContain('bad.css');
    } finally {
      warnSpy.mockRestore();
      chmodSync(unreadable, 0o644);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
