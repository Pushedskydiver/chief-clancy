import { describe, expect, it } from 'vitest';
import { z } from 'zod/mini';

import { designSchema } from './design.js';

describe('designSchema', () => {
  it('round-trips a minimal DESIGN.json fixture (parse + serialize)', () => {
    const fixture = {
      version: '0.1',
      visual_theme: {
        mood: 'minimal, focused',
        density: 'comfortable',
        philosophy: 'less but better',
      },
      color_palette: [{ name: 'primary', hex: '#0066cc', role: 'cta' }],
      tokens: {
        color: {
          primary: { $value: '#0066cc', $type: 'color' },
        },
      },
    };

    const parsed = z.safeParse(designSchema, fixture);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const serialized = JSON.stringify(parsed.data);
    const reparsed = z.safeParse(designSchema, JSON.parse(serialized));
    expect(reparsed.success).toBe(true);
    if (!reparsed.success) return;

    expect(reparsed.data).toEqual(fixture);
  });

  it('accepts a minimal input with only the required version field', () => {
    const result = z.safeParse(designSchema, { version: '0.1' });
    expect(result.success).toBe(true);
  });

  it('rejects input missing the required version field', () => {
    const result = z.safeParse(designSchema, {});
    expect(result.success).toBe(false);
  });

  it('rejects color_palette entries missing required name or hex', () => {
    const missingName = z.safeParse(designSchema, {
      version: '0.1',
      color_palette: [{ hex: '#0066cc' }],
    });
    expect(missingName.success).toBe(false);

    const missingHex = z.safeParse(designSchema, {
      version: '0.1',
      color_palette: [{ name: 'primary' }],
    });
    expect(missingHex.success).toBe(false);
  });

  it('round-trips the full canonical 9-section structure', () => {
    const fixture = {
      version: '0.1',
      generated_at: '2026-05-11T22:00:00Z',
      visual_theme: { mood: 'editorial', density: 'spacious', philosophy: '' },
      color_palette: [{ name: 'primary', hex: '#000', role: 'cta' }],
      typography: {
        families: ['Inter', 'Georgia'],
        hierarchy: [
          { name: 'h1', size: '48px', weight: '700', line_height: '1.1' },
        ],
      },
      components: [{ name: 'button', states: { hover: { opacity: 0.9 } } }],
      layout: {
        spacing_scale: ['4px', '8px', '16px'],
        grid: '12-col',
        whitespace_philosophy: 'generous',
      },
      depth: {
        shadows: ['0 1px 2px rgba(0,0,0,0.1)'],
        surfaces: ['paper', 'elevated'],
      },
      guardrails: {
        dos: ['use semantic tokens'],
        donts: ['avoid hardcoded hex values'],
      },
      responsive: {
        breakpoints: { sm: '640px', md: '768px' },
        touch_targets: '44px min',
        collapsing: 'sidebar → drawer at md',
      },
      agent_prompts: {
        color_reference: 'primary=#000',
        ready_to_use: ['Build a hero section with primary CTA'],
      },
      tokens: {
        color: { primary: { $value: '#000', $type: 'color' } },
      },
    };

    const parsed = z.safeParse(designSchema, fixture);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual(fixture);
  });
});
