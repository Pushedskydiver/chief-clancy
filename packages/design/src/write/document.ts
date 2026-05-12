/**
 * DESIGN.md + DESIGN.json writer — Phase F slice 7.
 *
 * Runs the four slice 2-5 detectors against `projectRoot`, composes a
 * `designSchema`-valid v0.1 object, and writes:
 *
 * - `.clancy/docs/DESIGN.json` — machine-readable, schema-validated.
 * - `.clancy/docs/DESIGN.md` — human-readable rendering of the same data.
 *
 * **v0.1 composition is mechanical pass-through.** The 9 canonical Stitch
 * sections (visual_theme, color_palette, typography, components, layout, depth,
 * guardrails, responsive, agent_prompts) require semantic enrichment that
 * detection alone cannot supply — they are left absent and populated later by
 * slice 9 (`clancy:design init` grill) or slice 11 (canvas variant
 * generation). Slice 7 only fills `version`, `generated_at`, and the permissive
 * `tokens` field with detect-output snapshots keyed by source layer
 * (`tailwind` / `css_vars` / `dtcg`).
 *
 * **Confidence tier** is computed by calling slice 5's `detectConfidence`
 * directly. This duplicates one `readdir(root)` (for the shadcn probe) and
 * one recursive `tokens.json` scan against work this module already does for
 * its own `dtcg` token snapshot — accepted as the cost of keeping the
 * shadcn-signal trust posture consistent with slice 5 (`Dirent.isFile()`,
 * no symlink follow). The alternative — re-implementing the shadcn probe
 * inline with `existsSync` — would diverge from slice 5's deliberate
 * symlink-rejection. Slice 5 also exports the pure-logic `getConfidenceTier`
 * surface for callers that already hold all three signals; we do not, so we
 * use the convenience surface.
 *
 * SECURITY: invoking `detectTailwind` executes the project's tailwind config
 * via jiti (same trust posture as the slice 2 module). Do not point
 * `clancy:design` at untrusted project roots.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { z } from 'zod/mini';

import { detectConfidence } from '../detect/confidence.js';
import { detectCssVars } from '../detect/css-vars.js';
import { detectTailwind } from '../detect/tailwind.js';
import { detectTokensJson } from '../detect/tokens-json.js';
import { designSchema } from '../schemas/design.js';

const SCHEMA_VERSION = '0.1';
const DOCS_DIR = join('.clancy', 'docs');
const DESIGN_JSON = 'DESIGN.json';
const DESIGN_MD = 'DESIGN.md';

type DocumentResult = {
  readonly designMdPath: string;
  readonly designJsonPath: string;
};

type TailwindResult = Awaited<ReturnType<typeof detectTailwind>>;
type CssVarsResult = Awaited<ReturnType<typeof detectCssVars>>;
type TokensJsonResult = Awaited<ReturnType<typeof detectTokensJson>>;
type ConfidenceTier = Awaited<ReturnType<typeof detectConfidence>>;

type Detections = {
  readonly tailwind: TailwindResult;
  readonly cssVars: CssVarsResult;
  readonly dtcg: TokensJsonResult;
  readonly tier: ConfidenceTier;
};

const buildTokens = (
  detections: Detections,
): Record<string, unknown> | undefined => {
  const tokens = {
    ...(detections.tailwind !== null ? { tailwind: detections.tailwind } : {}),
    ...(detections.cssVars !== null ? { css_vars: detections.cssVars } : {}),
    ...(detections.dtcg !== null ? { dtcg: detections.dtcg } : {}),
  };
  return Object.keys(tokens).length > 0 ? tokens : undefined;
};

const buildDesignJson = (detections: Detections): unknown => {
  const tokens = buildTokens(detections);
  return {
    version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    ...(tokens !== undefined ? { tokens } : {}),
  };
};

const renderDesignMd = (
  detections: Detections,
  designJson: { readonly generated_at: string },
): string => {
  const header: readonly string[] = [
    '# DESIGN',
    '',
    `_Generated ${designJson.generated_at} by \`clancy:design document\` (auto-detect baseline)._`,
    '',
    `**Confidence tier:** ${detections.tier}`,
    '',
  ];

  const noSignals =
    detections.tailwind === null &&
    detections.cssVars === null &&
    detections.dtcg === null;

  if (noSignals) {
    return [
      ...header,
      'No design-token signals detected. Run `clancy:design init` to draft a DESIGN.md from a 5-question grill.',
      '',
    ].join('\n');
  }

  const sourceBullets: readonly string[] = [
    detections.tailwind !== null
      ? '- **Tailwind config** — `theme.extend.{colors,spacing,fontSize}`'
      : null,
    detections.cssVars !== null
      ? '- **CSS custom properties** — `--*` declarations from `**/*.css`'
      : null,
    detections.dtcg !== null
      ? '- **DTCG tokens** — `tokens.json` files merged depth-wise'
      : null,
  ].filter((line): line is string => line !== null);

  return [
    ...header,
    'Detected token sources (auto-extracted; see `DESIGN.json` for the canonical data):',
    '',
    ...sourceBullets,
    '',
    'The 9 canonical Stitch sections (visual theme, color palette, typography, components, layout, depth, guardrails, responsive behavior, agent prompts) are not populated by `clancy:design document` — they require semantic enrichment. Run `clancy:design init` to draft them.',
    '',
  ].join('\n');
};

export async function document(projectRoot: string): Promise<DocumentResult> {
  const [tailwind, cssVars, dtcg, tier] = await Promise.all([
    detectTailwind(projectRoot),
    detectCssVars(projectRoot),
    detectTokensJson(projectRoot),
    detectConfidence(projectRoot),
  ]);

  const detections: Detections = { tailwind, cssVars, dtcg, tier };
  const designJson = buildDesignJson(detections);
  const validated = z.parse(designSchema, designJson);

  const docsDir = join(projectRoot, DOCS_DIR);
  await mkdir(docsDir, { recursive: true });

  const designJsonPath = join(docsDir, DESIGN_JSON);
  const designMdPath = join(docsDir, DESIGN_MD);

  await Promise.all([
    writeFile(
      designJsonPath,
      JSON.stringify(validated, null, 2) + '\n',
      'utf8',
    ),
    writeFile(
      designMdPath,
      renderDesignMd(detections, validated as { generated_at: string }),
      'utf8',
    ),
  ]);

  return { designMdPath, designJsonPath };
}
