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
 * some sections empty. Only `version` is required so consumers can branch on
 * schema evolution.
 *
 * The `tokens` field accepts a permissive DTCG tree — detection layer
 * (`src/detect/tokens-json.ts`) enforces DTCG node/group validity at parse
 * time; the schema layer accepts the pre-validated tree as-is.
 */
import { z } from 'zod/mini';

// ─── §1 Visual Theme & Atmosphere ────────────────────────────────────────────

const visualThemeSchema = z.object({
  mood: z.optional(z.string()),
  density: z.optional(z.string()),
  philosophy: z.optional(z.string()),
});

// ─── §2 Color Palette & Roles ────────────────────────────────────────────────

const colorPaletteEntrySchema = z.object({
  name: z.string(),
  hex: z.string(),
  role: z.optional(z.string()),
});

// ─── §3 Typography Rules ─────────────────────────────────────────────────────

const typographyHierarchyEntrySchema = z.object({
  name: z.string(),
  size: z.optional(z.string()),
  weight: z.optional(z.string()),
  line_height: z.optional(z.string()),
});

const typographySchema = z.object({
  families: z.optional(z.array(z.string())),
  hierarchy: z.optional(z.array(typographyHierarchyEntrySchema)),
});

// ─── §4 Component Stylings ───────────────────────────────────────────────────

const componentSchema = z.object({
  name: z.string(),
  states: z.optional(z.record(z.string(), z.unknown())),
});

// ─── §5 Layout Principles ────────────────────────────────────────────────────

const layoutSchema = z.object({
  spacing_scale: z.optional(z.array(z.string())),
  grid: z.optional(z.string()),
  whitespace_philosophy: z.optional(z.string()),
});

// ─── §6 Depth & Elevation ────────────────────────────────────────────────────

const depthSchema = z.object({
  shadows: z.optional(z.array(z.string())),
  surfaces: z.optional(z.array(z.string())),
});

// ─── §7 Do's and Don'ts ──────────────────────────────────────────────────────

const guardrailsSchema = z.object({
  dos: z.optional(z.array(z.string())),
  donts: z.optional(z.array(z.string())),
});

// ─── §8 Responsive Behavior ──────────────────────────────────────────────────

const responsiveSchema = z.object({
  breakpoints: z.optional(z.record(z.string(), z.string())),
  touch_targets: z.optional(z.string()),
  collapsing: z.optional(z.string()),
});

// ─── §9 Agent Prompt Guide ───────────────────────────────────────────────────

const agentPromptsSchema = z.object({
  color_reference: z.optional(z.string()),
  ready_to_use: z.optional(z.array(z.string())),
});

// ─── DTCG token tree ─────────────────────────────────────────────────────────

const tokensSchema = z.record(z.string(), z.unknown());

// ─── Root schema ─────────────────────────────────────────────────────────────

export const designSchema = z.object({
  version: z.string(),
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
