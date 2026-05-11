/**
 * DTCG `tokens.json` detection — Phase F slice 4.
 *
 * Recursively scans a project root for files named `tokens.json` and parses
 * each as a DTCG-shaped tree per the
 * [Design Tokens Community Group format spec](https://design-tokens.github.io/community-group/format/).
 * Multiple files are deep-merged last-wins after alphabetical sort, so the
 * result is deterministic across filesystems (raw `readdir` order is
 * unspecified).
 *
 * Output is the raw parsed DTCG tree — leaves carry `$value` / `$type` /
 * `$description`, groups carry nested child objects. Schema-level validation
 * (alias resolution, group `$type` inheritance, type-coerced values) defers
 * to slice 6's zod/mini `design.ts` schema.
 *
 * Known limitations:
 * - Filename matching is `tokens.json` exact-only (case-sensitive). The DTCG
 *   spec does not standardize a filename; this is the most common convention.
 *   `.tokens.json` / `design-tokens.json` / etc. are not matched at this
 *   slice — extend the matcher if real-world usage surfaces other names.
 * - Files containing top-level JSON arrays or primitives (legal JSON, not
 *   DTCG) are still parsed; slice 6 schema rejects them. At this slice they
 *   merge into the result and produce a malformed tree — operator's
 *   responsibility for now.
 *
 * Directory exclusions (`node_modules`, `dist`, `.git`, `build`, `.next`,
 * `.turbo`) follow common build-output convention — vendored, generated,
 * or version-control internals that carry no design-token authorship signal.
 *
 * SECURITY: same trust posture as slice 3's `detectCssVars`. Entries are
 * filtered through `Dirent.isFile()`, which returns false for symlinks,
 * sockets, FIFOs, and block devices — preventing path-traversal via symlink
 * and `readFile` hangs on FIFOs. Do not point `clancy:design` at untrusted
 * project roots.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

type DtcgTokens = Readonly<Record<string, unknown>>;

const EXCLUDE_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  'build',
  '.next',
  '.turbo',
]);

const TOKENS_FILENAME = 'tokens.json';

const readDirSafe = async (
  dir: string,
): Promise<
  readonly {
    readonly name: string;
    readonly isDir: boolean;
    readonly isFile: boolean;
  }[]
> => {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.map((e) => ({
      name: e.name,
      isDir: e.isDirectory(),
      isFile: e.isFile(),
    }));
  } catch {
    return [];
  }
};

const findTokensFiles = async (dir: string): Promise<readonly string[]> => {
  const entries = await readDirSafe(dir);
  const local = entries
    .filter((e) => e.isFile && e.name === TOKENS_FILENAME)
    .map((e) => join(dir, e.name));
  const nested = await Promise.all(
    entries
      .filter((e) => e.isDir && !EXCLUDE_DIRS.has(e.name))
      .map((e) => findTokensFiles(join(dir, e.name))),
  );
  return [...local, ...nested.flat()];
};

const readFileSafe = async (file: string): Promise<string | null> => {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[clancy:design] Failed to read ${file}: ${message}`);
    return null;
  }
};

const parseJsonSafe = (file: string, content: string): unknown => {
  try {
    return JSON.parse(content) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[clancy:design] Failed to parse ${file}: ${message}`);
    return null;
  }
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

const mergeKey = (
  key: string,
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): readonly [string, unknown] => {
  const t = target[key];
  const s = source[key];
  if (s === undefined) return [key, t];
  if (t === undefined) return [key, s];
  if (isPlainObject(t) && isPlainObject(s)) return [key, deepMerge(t, s)];
  return [key, s];
};

const deepMerge = (
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> => {
  const keys = new Set([...Object.keys(target), ...Object.keys(source)]);
  return Object.fromEntries(
    [...keys].map((key) => mergeKey(key, target, source)),
  );
};

export async function detectTokensJson(
  projectRoot: string,
): Promise<DtcgTokens | null> {
  const files = [...(await findTokensFiles(projectRoot))].sort();
  if (files.length === 0) return null;

  const contents = await Promise.all(files.map((file) => readFileSafe(file)));
  const parsed = files
    .map((file, i) => {
      const content = contents[i];
      return content === null ? null : parseJsonSafe(file, content);
    })
    .filter(isPlainObject);

  return parsed.reduce<Record<string, unknown>>(
    (acc, tree) => deepMerge(acc, tree),
    {},
  );
}
