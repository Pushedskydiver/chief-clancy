/**
 * 2-tier confidence detection — Phase F slice 5.
 *
 * Aggregates three binary "is this project design-system-aware?" signals
 * into a `'high' | 'low'` tier per the slice 5 spec cell:
 *
 * - **shadcn** — `components.json` at project root. Shadcn's CLI uses this
 *   file as its project-config marker; ecosystem treats its presence as
 *   evidence shadcn is in use. Root-only by convention.
 * - **tailwind** — any of `tailwind.config.{ts,js,mjs,cjs}` at project root.
 *   Same resolution order slice 2's `detectTailwind` uses. Root-only.
 * - **tokens.json** — DTCG token file anywhere in the tree (excluded dirs
 *   skipped). Recursive, mirroring slice 4's `detectTokensJson` scan.
 *
 * `ANY signal present → 'high'` (skip the document-init grill's broad
 * questions). `NONE → 'low'` (ask everything). 3-tier deferred to v0.2 per
 * spec note "pending real-usage data".
 *
 * The module exports two surfaces:
 * - `getConfidenceTier(signals)` — pure logic, decoupled from IO. Used by
 *   slice 7 `write/document.ts` when the caller already has signals in hand.
 * - `detectConfidence(projectRoot)` — scans the project root + delegates.
 *   The convenience surface for slice 8 CLI `clancy:design document`.
 *
 * SECURITY: signal probes use `Dirent.isFile()` on `readdir` output (not
 * `fs.access` / `fs.stat`) so symlinks are filtered out, matching the trust
 * posture of slices 2 + 3 + 4. A symlinked `components.json` or
 * `tailwind.config.js` does not count as a host-project signal.
 */
import { readdir } from 'node:fs/promises';

import { detectTokensJson } from './tokens-json.js';

type ConfidenceTier = 'high' | 'low';

type ConfidenceSignals = {
  readonly hasShadcn: boolean;
  readonly hasTailwind: boolean;
  readonly hasTokensJson: boolean;
};

const SHADCN_CONFIG_FILENAME = 'components.json';

const TAILWIND_CONFIG_FILENAMES = new Set([
  'tailwind.config.ts',
  'tailwind.config.js',
  'tailwind.config.mjs',
  'tailwind.config.cjs',
]);

const readRootFiles = async (root: string): Promise<ReadonlySet<string>> => {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return new Set(entries.filter((e) => e.isFile()).map((e) => e.name));
  } catch {
    return new Set();
  }
};

export function getConfidenceTier(signals: ConfidenceSignals): ConfidenceTier {
  const anyPresent =
    signals.hasShadcn || signals.hasTailwind || signals.hasTokensJson;
  return anyPresent ? 'high' : 'low';
}

export async function detectConfidence(
  projectRoot: string,
): Promise<ConfidenceTier> {
  const [rootFiles, tokensResult] = await Promise.all([
    readRootFiles(projectRoot),
    detectTokensJson(projectRoot),
  ]);
  const hasShadcn = rootFiles.has(SHADCN_CONFIG_FILENAME);
  const hasTailwind = [...TAILWIND_CONFIG_FILENAMES].some((name) =>
    rootFiles.has(name),
  );
  const hasTokensJson = tokensResult !== null;
  return getConfidenceTier({ hasShadcn, hasTailwind, hasTokensJson });
}
