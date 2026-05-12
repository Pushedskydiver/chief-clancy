import type { GrillAnswers } from './init.js';

import { describe, expect, it } from 'vitest';

import {
  ANTHROPIC_AESTHETIC_TAXONOMY,
  buildDesignMd,
  buildProductMd,
  SCALE_FAMILY_OPTIONS,
  THEME_OPTIONS,
} from './init.js';

const fixtureAnswers: GrillAnswers = {
  audience: 'beginner web developers',
  brandVoice: 'concise + technical',
  aesthetic: 'brutally minimal',
  scaleFamily: 'single product',
  theme: 'dark',
  antiReferences: 'no skeuomorphism',
};

const fixtureGeneratedAt = '2026-05-12T12:00:00.000Z';

describe('ANTHROPIC_AESTHETIC_TAXONOMY', () => {
  it('contains the 11 verbatim directions from the Anthropic frontend-design SKILL.md', () => {
    // Pinned verbatim against the source list at
    // ~/.claude/plugins/marketplaces/claude-plugins-official/plugins/frontend-design/skills/frontend-design/SKILL.md
    // — if the SKILL.md taxonomy moves, this test signals the drift.
    expect(ANTHROPIC_AESTHETIC_TAXONOMY).toEqual([
      'brutally minimal',
      'maximalist chaos',
      'retro-futuristic',
      'organic/natural',
      'luxury/refined',
      'playful/toy-like',
      'editorial/magazine',
      'brutalist/raw',
      'art deco/geometric',
      'soft/pastel',
      'industrial/utilitarian',
    ]);
  });
});

describe('SCALE_FAMILY_OPTIONS', () => {
  it('exposes the three v0.1 scale-family options', () => {
    expect(SCALE_FAMILY_OPTIONS).toEqual([
      'single product',
      'multi-surface',
      'design-system-at-large',
    ]);
  });
});

describe('THEME_OPTIONS', () => {
  it('exposes light / dark / both per spec L847', () => {
    expect(THEME_OPTIONS).toEqual(['light', 'dark', 'both']);
  });
});

describe('buildProductMd', () => {
  it('renders all 6 grill answers under named sections in spec order', () => {
    const md = buildProductMd(fixtureAnswers, fixtureGeneratedAt);

    // H1 + scaffolding marker first.
    expect(md.startsWith('# PRODUCT\n')).toBe(true);
    expect(md).toContain(
      `Scaffolded by \`clancy:design init\` on ${fixtureGeneratedAt}`,
    );

    // 6 sections in the spec-named order — verify each heading appears
    // before the next so a reordering regression fails noisily.
    const headings = [
      '## Audience',
      '## Brand Voice',
      '## Aesthetic Direction',
      '## Scale & Context',
      '## Theme',
      '## Anti-references',
    ];
    const indices = headings.map((h) => md.indexOf(h));
    expect(indices.every((i) => i >= 0)).toBe(true);
    // Monotonically increasing — each heading appears before the next.
    const monotonic = indices
      .slice(0, -1)
      .every((idx, i) => idx < indices[i + 1]);
    expect(monotonic).toBe(true);

    // Each answer appears in its own section body.
    expect(md).toContain('beginner web developers');
    expect(md).toContain('concise + technical');
    expect(md).toContain('brutally minimal');
    expect(md).toContain('single product');
    expect(md).toContain('dark');
    expect(md).toContain('no skeuomorphism');
  });

  it('ends with a trailing newline so concatenation does not eat content', () => {
    const md = buildProductMd(fixtureAnswers, fixtureGeneratedAt);
    expect(md.endsWith('\n')).toBe(true);
  });
});

describe('buildDesignMd', () => {
  it('renders the 9 canonical Stitch section headings as TBD placeholders', () => {
    const md = buildDesignMd(fixtureAnswers, fixtureGeneratedAt);

    // The 9 canonical sections per slice 6 designSchema field names,
    // rendered as human-readable markdown headings.
    const sectionHeadings = [
      '## Visual Theme & Atmosphere',
      '## Color Palette & Roles',
      '## Typography Rules',
      '## Component Stylings',
      '## Layout Principles',
      '## Depth & Elevation',
      "## Do's and Don'ts",
      '## Responsive Behavior',
      '## Agent Prompt Guide',
    ];
    sectionHeadings.forEach((heading) => {
      expect(md).toContain(heading);
    });

    // Each section currently carries a `_TBD_` placeholder — exactly 9.
    const tbdCount = md.match(/^_TBD_$/gm)?.length ?? 0;
    expect(tbdCount).toBe(9);
  });

  it('includes a pointer back to `clancy:design document` for once tokens exist', () => {
    const md = buildDesignMd(fixtureAnswers, fixtureGeneratedAt);
    expect(md).toContain('clancy:design document');
  });

  it('starts with H1 + scaffolded-by marker', () => {
    const md = buildDesignMd(fixtureAnswers, fixtureGeneratedAt);
    expect(md.startsWith('# DESIGN\n')).toBe(true);
    expect(md).toContain(
      `Scaffolded by \`clancy:design init\` on ${fixtureGeneratedAt}`,
    );
  });

  it('ends with a trailing newline (symmetric with PRODUCT.md — DA L5 fold)', () => {
    const md = buildDesignMd(fixtureAnswers, fixtureGeneratedAt);
    expect(md.endsWith('\n')).toBe(true);
  });
});
