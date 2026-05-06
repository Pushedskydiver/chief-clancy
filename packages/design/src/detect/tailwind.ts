/**
 * Tailwind config detection — Phase F slice 2.
 *
 * Locates `tailwind.config.{js,cjs,mjs,ts}` in a project root and extracts the
 * three theme.extend axes the canvas + handoff stages care about: colors,
 * spacing, fontSize. Schema validation lands in slice 6; for now values are
 * carried through as `unknown` so detection does not lose information.
 *
 * Resolution order matches Tailwind's own loader (`.js` → `.cjs` → `.mjs` →
 * `.ts`) for the four extensions Clancy detects. Tailwind v3 also supports
 * `.cts` / `.mts`; those are out of scope for slice 2 (a `.cts`-only or
 * `.mts`-only project will see Clancy return `null` while Tailwind happily
 * reads the file). Adding the two formats is a follow-up if user demand
 * surfaces. `.ts` configs are loaded via `jiti` (the canonical Node-ecosystem
 * runtime TypeScript loader) so detection works against modern TS-first
 * Tailwind v3/v4 projects without a build step.
 *
 * SECURITY: this function executes the project's tailwind config file as
 * JavaScript via `jiti`. Same trust posture as Tailwind / Vite / Vitest /
 * ESLint — config files run with the invoking user's permissions. Do not
 * point `clancy:design` at untrusted project roots.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { createJiti } from 'jiti';

const CANDIDATE_FILES = [
  'tailwind.config.js',
  'tailwind.config.cjs',
  'tailwind.config.mjs',
  'tailwind.config.ts',
] as const;

type TailwindConfigShape = {
  readonly theme?: {
    readonly extend?: Readonly<Record<string, unknown>>;
  };
};

type TailwindTokens = {
  readonly colors: Readonly<Record<string, unknown>>;
  readonly spacing: Readonly<Record<string, unknown>>;
  readonly fontSize: Readonly<Record<string, unknown>>;
};

const asRecord = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {};

const extractTokens = (config: TailwindConfigShape): TailwindTokens => {
  const extend = config?.theme?.extend ?? {};
  return {
    colors: asRecord(extend.colors),
    spacing: asRecord(extend.spacing),
    fontSize: asRecord(extend.fontSize),
  };
};

export async function detectTailwind(
  projectRoot: string,
): Promise<TailwindTokens | null> {
  const found = CANDIDATE_FILES.find((file) =>
    existsSync(join(projectRoot, file)),
  );
  if (!found) return null;

  const configPath = join(projectRoot, found);
  const jiti = createJiti(import.meta.url, { interopDefault: true });
  try {
    const unverifiedConfig = await jiti.import<TailwindConfigShape>(
      configPath,
      { default: true },
    );
    return extractTokens(unverifiedConfig);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[clancy:design] Failed to read ${found} in ${projectRoot}: ${message}`,
    );
    return null;
  }
}
