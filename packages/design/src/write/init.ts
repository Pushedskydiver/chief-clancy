/**
 * Greenfield `init` writers + canonical grill option lists — Phase F slice 9.
 *
 * Pure functions (no IO) consumed by `src/commands/init.ts` after the 6-question
 * grill collects answers. Two output documents:
 *
 * - **PRODUCT.md** — 6 sections (Audience, Brand Voice, Aesthetic Direction,
 *   Scale & Context, Theme, Anti-references) mapped 1:1 from grill answers.
 *   `clancy:brief` slice 26 will eventually read this for brand-voice context;
 *   for now it's a user-facing scaffold.
 *
 * - **DESIGN.md** — greenfield placeholder with the 9 canonical Stitch
 *   section headings (matching the slice 6 `designSchema` field names) as
 *   `_TBD_` placeholders. Real population comes later: `clancy:design
 *   document` extracts tokens once they exist; canvas variant generation
 *   (slices 10+) refines visual direction.
 *
 * Anti-references is novel to slice 9 (not in spec L847's named-5 list) and
 * captures Impeccable's "what we aren't as a compass" pattern verified via
 * prior-art scan at session-start. Spec amendment pending.
 */

/**
 * Aesthetic direction taxonomy — verbatim from Anthropic's frontend-design
 * SKILL.md at `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/frontend-design/skills/frontend-design/SKILL.md`.
 * The source list ends with "etc." (open-ended); v0.1 surfaces the 11 named
 * directions. User can edit PRODUCT.md to add a custom direction after init.
 */
export const ANTHROPIC_AESTHETIC_TAXONOMY: readonly string[] = [
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
];

export const SCALE_FAMILY_OPTIONS: readonly string[] = [
  'single product',
  'multi-surface',
  'design-system-at-large',
];

export const THEME_OPTIONS: readonly string[] = ['light', 'dark', 'both'];

export type GrillAnswers = {
  readonly audience: string;
  readonly brandVoice: string;
  readonly aesthetic: string;
  readonly scaleFamily: string;
  readonly theme: string;
  readonly antiReferences: string;
};

const scaffoldedBy = (generatedAt: string): string =>
  `_Scaffolded by \`clancy:design init\` on ${generatedAt}._`;

export const buildProductMd = (
  answers: GrillAnswers,
  generatedAt: string,
): string =>
  [
    '# PRODUCT',
    '',
    scaffoldedBy(generatedAt),
    '',
    '## Audience',
    '',
    answers.audience,
    '',
    '## Brand Voice',
    '',
    answers.brandVoice,
    '',
    '## Aesthetic Direction',
    '',
    answers.aesthetic,
    '',
    '## Scale & Context',
    '',
    answers.scaleFamily,
    '',
    '## Theme',
    '',
    answers.theme,
    '',
    '## Anti-references',
    '',
    answers.antiReferences,
    '',
  ].join('\n');

export const buildDesignMd = (
  _answers: GrillAnswers,
  generatedAt: string,
): string =>
  [
    '# DESIGN',
    '',
    scaffoldedBy(generatedAt),
    '',
    'Greenfield design system — fill in as the system takes shape. Run `clancy:design document` once you have Tailwind config / CSS variables / design-token JSON to extract from.',
    '',
    '## Visual Theme & Atmosphere',
    '',
    '_TBD_',
    '',
    '## Color Palette & Roles',
    '',
    '_TBD_',
    '',
    '## Typography Rules',
    '',
    '_TBD_',
    '',
    '## Component Stylings',
    '',
    '_TBD_',
    '',
    '## Layout Principles',
    '',
    '_TBD_',
    '',
    '## Depth & Elevation',
    '',
    '_TBD_',
    '',
    "## Do's and Don'ts",
    '',
    '_TBD_',
    '',
    '## Responsive Behavior',
    '',
    '_TBD_',
    '',
    '## Agent Prompt Guide',
    '',
    '_TBD_',
    '',
  ].join('\n');
