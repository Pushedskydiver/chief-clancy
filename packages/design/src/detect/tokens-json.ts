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
 * `$description`, groups carry nested child objects. v0.1 performs no DTCG
 * semantic validation at any layer: alias resolution, group `$type`
 * inheritance, `$type` enumeration, and `$value` coercion are deferred to a
 * future slice when consuming layers surface concrete validity bugs. Slice
 * 6's `schemas/design.ts` accepts the token tree as `Record<string, unknown>`
 * without further checks.
 *
 * Known limitations:
 * - Filename matching is `tokens.json` exact-only (case-sensitive). The DTCG
 *   spec does not standardize a filename; this is the most common convention.
 *   `.tokens.json` / `design-tokens.json` / etc. are not matched at this
 *   slice — extend the matcher if real-world usage surfaces other names.
 * - Files whose top-level JSON value is not a plain object (array, primitive,
 *   `null`) are silently dropped from the merge — `JSON.parse` succeeds but
 *   the `isPlainObject` filter rejects them, so the result is unaffected and
 *   no warning is emitted. No downstream schema layer warns either (per the
 *   v0.1 DTCG-semantic-validation deferral noted above).
 * - Multi-file token-vs-group collisions on the same key path (one file
 *   declares the path as a token via `$value`, another as a group via child
 *   keys) emit a `console.warn` and resolve last-wins. The merged tree
 *   itself is XOR-clean (the surviving side fully replaces the other), but
 *   the warning surfaces the conflicting authorship so the operator can
 *   reconcile rather than silently lose half the declaration.
 *
 * Directory exclusions (`node_modules`, `dist`, `.git`, `build`, `.next`,
 * `.turbo`) follow common build-output convention — vendored, generated,
 * or version-control internals that carry no design-token authorship signal.
 *
 * SECURITY: same trust posture as slice 3's `detectCssVars`. Entries are
 * filtered through `Dirent.isFile()`, which returns false for symlinks,
 * sockets, FIFOs, and block devices — preventing path-traversal via symlink
 * and `readFile` hangs on FIFOs. The `isPlainObject` prototype check is
 * load-bearing against `__proto__`-keyed JSON: `JSON.parse` produces an own
 * property for `__proto__` (not a prototype mutation), and the merge pipeline
 * preserves that — but only as long as the prototype identity check stays
 * in place. Do not point `clancy:design` at untrusted project roots.
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

// DTCG spec: a node is a *token* iff it has a `$value` key, otherwise it's
// a *group*. `$type` alone is legal on a group (sets default type for
// descendants) so `$value` is the only discriminator. See
// https://design-tokens.github.io/community-group/format/#groups-and-tokens.
const isDtcgToken = (obj: Record<string, unknown>): boolean => '$value' in obj;

type MergeContext = {
  readonly target: Record<string, unknown>;
  readonly source: Record<string, unknown>;
  readonly sourceFile: string;
};

type ObjectMergePair = {
  readonly t: Record<string, unknown>;
  readonly s: Record<string, unknown>;
  readonly sourceFile: string;
};

const mergeObjectValues = (
  key: string,
  pair: ObjectMergePair,
): readonly [string, unknown] => {
  const { t, s, sourceFile } = pair;
  const tToken = isDtcgToken(t);
  const sToken = isDtcgToken(s);
  if (tToken === sToken) {
    return tToken ? [key, s] : [key, deepMerge(t, s, sourceFile)];
  }
  // Hybrid collision: DTCG spec forbids a node from being both token + group.
  // Warn with source-file path; resolve last-wins so the operator can decide.
  console.warn(
    `[clancy:design] DTCG token/group conflict on key '${key}' in ${sourceFile}: ` +
      `this file declares it as a ${sToken ? 'token' : 'group'} but an earlier file ` +
      `declared it as a ${tToken ? 'token' : 'group'}. Using ${sourceFile} (last-wins).`,
  );
  return [key, s];
};

const mergeKey = (
  key: string,
  ctx: MergeContext,
): readonly [string, unknown] => {
  const t = ctx.target[key];
  const s = ctx.source[key];
  if (s === undefined) return [key, t];
  if (t === undefined) return [key, s];
  if (!isPlainObject(t) || !isPlainObject(s)) return [key, s];
  return mergeObjectValues(key, { t, s, sourceFile: ctx.sourceFile });
};

const deepMerge = (
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  sourceFile: string,
): Record<string, unknown> => {
  const keys = new Set([...Object.keys(target), ...Object.keys(source)]);
  return Object.fromEntries(
    [...keys].map((key) => mergeKey(key, { target, source, sourceFile })),
  );
};

export async function detectTokensJson(
  projectRoot: string,
): Promise<DtcgTokens | null> {
  const files = [...(await findTokensFiles(projectRoot))].sort();
  if (files.length === 0) return null;

  const contents = await Promise.all(files.map((file) => readFileSafe(file)));
  const parsed = files.flatMap((file, i) => {
    const content = contents[i];
    if (content === null) return [];
    const tree = parseJsonSafe(file, content);
    return isPlainObject(tree) ? [{ file, tree }] : [];
  });

  return parsed.reduce<Record<string, unknown>>(
    (acc, { file, tree }) => deepMerge(acc, tree, file),
    {},
  );
}
