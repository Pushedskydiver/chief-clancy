/**
 * 2-tier confidence detection — Phase F slice 5.
 *
 * Aggregates three binary "is this project design-system-aware?" signals
 * into a `'high' | 'low'` tier per the slice 5 spec cell:
 *
 * - **shadcn** — `components.json` at project root. Shadcn's CLI uses this
 *   file as its project-config marker; ecosystem treats its presence as
 *   evidence shadcn is in use. Root-only by convention.
 * - **tailwind** — any of `tailwind.config.{ts,js,mjs,cjs}` at project root;
 *   order-insensitive since the signal is binary. Root-only.
 * - **tokens.json** — any file named `tokens.json` anywhere in the tree
 *   (excluded dirs skipped). Filename presence alone is the authorship
 *   signal; content is not validated at this layer — slice 6 schema
 *   validates DTCG shape. Recursive via slice 4's `detectTokensJson`.
 *
 * Root-vs-recursive asymmetry: shadcn + tailwind are root-only because
 * their CLI conventions read from project root; tokens.json has no such
 * convention and DTCG's "anywhere in the tree" matches monorepo authoring
 * (e.g. `packages/ui/design/tokens.json`).
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
 * SECURITY: signal probes — `readRootFiles` directly, and slice 4's
 * `detectTokensJson` transitively — use `Dirent.isFile()` on `readdir`
 * output (not `fs.access` / `fs.stat` / `existsSync`) so symlinks are
 * filtered out, matching the trust posture of slices 3 + 4. (Slice 2's
 * `detectTailwind` uses `existsSync`, which follows symlinks; the
 * confidence module's own tailwind probe via `readRootFiles` does not
 * inherit that gap.) A symlinked `components.json` or `tailwind.config.js`
 * does not count as a host-project signal at the confidence layer.
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
