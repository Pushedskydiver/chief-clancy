/**
 * DESIGN.json schema — Stitch + DTCG hybrid.
 *
 * Stitch (https://stitch.withgoogle.com/docs/design-md/format/) defines a
 * 9-section canonical structure for design-direction documents. DESIGN.json is
 * the machine-readable JSON shape of that structure plus a DTCG token tree
 * (https://design-tokens.github.io/community-group/format/) for the token
 * catalog.
 *
 * All section fields are optional in v0.1: real-world DESIGN.json files won't
 * always populate every canonical section, and detection-confidence may leave
 * some sections empty. Only `version` is required (non-empty) so consumers
 * can branch on schema evolution.
 *
 * **Forward compatibility:** the root and all section schemas use
 * `z.looseObject`, so a v0.1 reader round-trips unknown keys preserved
 * (vs the default `z.object` strip mode which drops them silently). This lets
 * v0.1 readers carry future-version fields across parse → serialize without
 * loss.
 *
 * **DTCG token tree:** the `tokens` field accepts an arbitrary
 * `Record<string, unknown>`. **No DTCG semantic validation is performed at
 * any layer in v0.1** — neither here nor at slice 4's `detect/tokens-json.ts`
 * (which does structural filtering only: prototype check + isPlainObject +
 * token/group collision warning). Alias resolution, `$type` enumeration,
 * `$value` coercion, and group `$type` inheritance are all deferred to a
 * future slice when consuming layers surface concrete validity bugs. Field
 * names are snake_case throughout to match the Stitch canonical format.
 */
import { z } from 'zod/mini';

const nonEmpty = z.string().check(z.minLength(1));
const hexColor = z
  .string()
  .check(z.regex(/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/));

// ─── §1 Visual Theme & Atmosphere ────────────────────────────────────────────

const visualThemeSchema = z.looseObject({
  mood: z.optional(z.string()),
  density: z.optional(z.string()),
  philosophy: z.optional(z.string()),
});

// ─── §2 Color Palette & Roles ────────────────────────────────────────────────

const colorPaletteEntrySchema = z.looseObject({
  name: nonEmpty,
  hex: hexColor,
  role: z.optional(z.string()),
});

// ─── §3 Typography Rules ─────────────────────────────────────────────────────

const typographyHierarchyEntrySchema = z.looseObject({
  name: nonEmpty,
  size: z.optional(z.string()),
  weight: z.optional(z.string()),
  line_height: z.optional(z.string()),
});

const typographySchema = z.looseObject({
  families: z.optional(z.array(z.string())),
  hierarchy: z.optional(z.array(typographyHierarchyEntrySchema)),
});

// ─── §4 Component Stylings ───────────────────────────────────────────────────

const componentSchema = z.looseObject({
  name: nonEmpty,
  states: z.optional(z.record(z.string(), z.unknown())),
});

// ─── §5 Layout Principles ────────────────────────────────────────────────────

const layoutSchema = z.looseObject({
  spacing_scale: z.optional(z.array(z.string())),
  grid: z.optional(z.string()),
  whitespace_philosophy: z.optional(z.string()),
});

// ─── §6 Depth & Elevation ────────────────────────────────────────────────────

const depthSchema = z.looseObject({
  shadows: z.optional(z.array(z.string())),
  surfaces: z.optional(z.array(z.string())),
});

// ─── §7 Do's and Don'ts ──────────────────────────────────────────────────────

const guardrailsSchema = z.looseObject({
  dos: z.optional(z.array(z.string())),
  donts: z.optional(z.array(z.string())),
});

// ─── §8 Responsive Behavior ──────────────────────────────────────────────────

const responsiveSchema = z.looseObject({
  breakpoints: z.optional(z.record(z.string(), z.string())),
  touch_targets: z.optional(z.string()),
  collapsing: z.optional(z.string()),
});

// ─── §9 Agent Prompt Guide ───────────────────────────────────────────────────

const agentPromptsSchema = z.looseObject({
  color_reference: z.optional(z.string()),
  ready_to_use: z.optional(z.array(z.string())),
});

// ─── DTCG token tree (permissive — no v0.1 semantic validation per TSDoc) ────

const tokensSchema = z.record(z.string(), z.unknown());

// ─── Root schema ─────────────────────────────────────────────────────────────

export const designSchema = z.looseObject({
  version: nonEmpty,
  generated_at: z.optional(z.string()),
  visual_theme: z.optional(visualThemeSchema),
  color_palette: z.optional(z.array(colorPaletteEntrySchema)),
  typography: z.optional(typographySchema),
  components: z.optional(z.array(componentSchema)),
  layout: z.optional(layoutSchema),
  depth: z.optional(depthSchema),
  guardrails: z.optional(guardrailsSchema),
  responsive: z.optional(responsiveSchema),
  agent_prompts: z.optional(agentPromptsSchema),
  tokens: z.optional(tokensSchema),
});
