import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/mini';

import { designSchema } from '../schemas/design.js';
import { document } from './document.js';

describe('document', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'clancy-design-document-'));
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('writes DESIGN.md and DESIGN.json to .clancy/docs/ for an empty project', async () => {
    const result = await document(projectRoot);

    expect(result.designMdPath).toBe(
      join(projectRoot, '.clancy', 'docs', 'DESIGN.md'),
    );
    expect(result.designJsonPath).toBe(
      join(projectRoot, '.clancy', 'docs', 'DESIGN.json'),
    );

    const jsonContent = await readFile(result.designJsonPath, 'utf8');
    const parsed: unknown = JSON.parse(jsonContent);

    const validation = z.safeParse(designSchema, parsed);
    expect(validation.success).toBe(true);
    if (!validation.success) return;

    expect(validation.data.version).toBe('0.1');
    expect(typeof validation.data.generated_at).toBe('string');

    const mdContent = await readFile(result.designMdPath, 'utf8');
    expect(mdContent).toMatch(/^# DESIGN/m);
  });

  it('writes Tailwind detect output under tokens.tailwind and lists the section in DESIGN.md', async () => {
    await writeFile(
      join(projectRoot, 'tailwind.config.js'),
      `module.exports = {
  theme: {
    extend: {
      colors: { brand: '#0066cc' },
      spacing: { md: '1rem' },
      fontSize: { base: '1rem' },
    },
  },
};
`,
      'utf8',
    );

    const result = await document(projectRoot);

    const parsed: unknown = JSON.parse(
      await readFile(result.designJsonPath, 'utf8'),
    );
    const validation = z.safeParse(designSchema, parsed);
    expect(validation.success).toBe(true);
    if (!validation.success) return;

    expect(validation.data.tokens).toEqual({
      tailwind: {
        colors: { brand: '#0066cc' },
        spacing: { md: '1rem' },
        fontSize: { base: '1rem' },
      },
    });

    const mdContent = await readFile(result.designMdPath, 'utf8');
    expect(mdContent).toContain('**Tailwind config**');
    expect(mdContent).not.toContain('No design-token signals detected');
  });

  it('writes CSS custom-property detect output under tokens.css_vars and lists the section in DESIGN.md', async () => {
    await writeFile(
      join(projectRoot, 'tokens.css'),
      `:root {
  --brand: #0066cc;
  --space-md: 1rem;
}
`,
      'utf8',
    );

    const result = await document(projectRoot);

    const parsed: unknown = JSON.parse(
      await readFile(result.designJsonPath, 'utf8'),
    );
    const validation = z.safeParse(designSchema, parsed);
    expect(validation.success).toBe(true);
    if (!validation.success) return;

    expect(validation.data.tokens).toEqual({
      css_vars: {
        '--brand': '#0066cc',
        '--space-md': '1rem',
      },
    });

    const mdContent = await readFile(result.designMdPath, 'utf8');
    expect(mdContent).toContain('**CSS custom properties**');
  });

  it('writes DTCG tokens.json detect output under tokens.dtcg and lists the section in DESIGN.md', async () => {
    await writeFile(
      join(projectRoot, 'tokens.json'),
      JSON.stringify({
        color: { primary: { $value: '#0066cc', $type: 'color' } },
      }),
      'utf8',
    );

    const result = await document(projectRoot);

    const parsed: unknown = JSON.parse(
      await readFile(result.designJsonPath, 'utf8'),
    );
    const validation = z.safeParse(designSchema, parsed);
    expect(validation.success).toBe(true);
    if (!validation.success) return;

    expect(validation.data.tokens).toEqual({
      dtcg: {
        color: { primary: { $value: '#0066cc', $type: 'color' } },
      },
    });

    const mdContent = await readFile(result.designMdPath, 'utf8');
    expect(mdContent).toContain('**DTCG tokens**');
  });

  it('merges all three signal sources into separate tokens.* keys when present together', async () => {
    await writeFile(
      join(projectRoot, 'tailwind.config.js'),
      `module.exports = { theme: { extend: { colors: { brand: '#abc123' } } } };\n`,
      'utf8',
    );
    await writeFile(
      join(projectRoot, 'vars.css'),
      `:root { --space: 8px; }\n`,
      'utf8',
    );
    await writeFile(
      join(projectRoot, 'tokens.json'),
      JSON.stringify({
        color: { accent: { $value: '#ff0080', $type: 'color' } },
      }),
      'utf8',
    );

    const result = await document(projectRoot);

    const parsed: unknown = JSON.parse(
      await readFile(result.designJsonPath, 'utf8'),
    );
    const validation = z.safeParse(designSchema, parsed);
    expect(validation.success).toBe(true);
    if (!validation.success) return;

    const tokens = validation.data.tokens as Record<string, unknown>;
    expect(Object.keys(tokens).sort()).toEqual([
      'css_vars',
      'dtcg',
      'tailwind',
    ]);
  });

  it('marks confidence tier high when any signal fires and low when none do', async () => {
    const emptyResult = await document(projectRoot);
    const emptyMd = await readFile(emptyResult.designMdPath, 'utf8');
    expect(emptyMd).toContain('**Confidence tier:** low');

    await writeFile(
      join(projectRoot, 'components.json'),
      JSON.stringify({ style: 'default' }),
      'utf8',
    );
    const highResult = await document(projectRoot);
    const highMd = await readFile(highResult.designMdPath, 'utf8');
    expect(highMd).toContain('**Confidence tier:** high');
  });
});
