/**
 * CSS custom-property detection — Phase F slice 3.
 *
 * Recursively scans a project root for `*.css` files, strips block comments,
 * and extracts top-level `--<name>: <value>` declarations into a flat
 * last-wins map. Scope-bound variables (e.g. `:root` vs `.dark`) are not
 * differentiated at this slice; slice 6 schema may revisit.
 *
 * Known limitations:
 * - Multi-line values are out of scope — the regex stops at the first `;`
 *   or `}` on the declaration's line.
 * - Values containing semicolons (e.g. data URIs like
 *   `url(data:image/svg+xml;base64,...)`) are silently truncated at the
 *   first `;`. Proper CSS parser at slice 6 schema.
 * - Filename matching is case-sensitive (`STYLES.CSS` is skipped). Rare in
 *   modern toolchains.
 *
 * Directory exclusions (`node_modules`, `dist`, `.git`, `build`, `.next`,
 * `.turbo`) follow common build-output convention — vendored, generated,
 * or version-control internals that carry no design-token authorship
 * signal. Clancy-local list; extend as new conventions surface.
 *
 * Files are sorted alphabetically before aggregation so last-wins becomes
 * deterministic across filesystems (raw `readdir` order is unspecified).
 *
 * SECURITY: this function reads files in the project root. Entries are
 * filtered through `Dirent.isFile()`, which returns false for symlinks,
 * sockets, FIFOs, and block devices — preventing both path-traversal via
 * symlink and `readFile` hangs on FIFOs. Same trust posture as slice 2's
 * `detectTailwind`: do not point `clancy:design` at untrusted project
 * roots.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

type CssVars = Readonly<Record<string, string>>;

const EXCLUDE_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  'build',
  '.next',
  '.turbo',
]);

const VAR_DECLARATION = /--([\w-]+)\s*:\s*([^;}]+?)\s*(?:;|}|$)/gm;

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;

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

const findCssFiles = async (dir: string): Promise<readonly string[]> => {
  const entries = await readDirSafe(dir);
  const localCss = entries
    .filter((e) => e.isFile && e.name.endsWith('.css'))
    .map((e) => join(dir, e.name));
  const nested = await Promise.all(
    entries
      .filter((e) => e.isDir && !EXCLUDE_DIRS.has(e.name))
      .map((e) => findCssFiles(join(dir, e.name))),
  );
  return [...localCss, ...nested.flat()];
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

const matchToVarEntry = (
  match: RegExpMatchArray,
): readonly (readonly [string, string])[] => {
  const [, name, value] = match;
  return name && value ? [[`--${name}`, value]] : [];
};

const extractVars = (content: string): readonly (readonly [string, string])[] =>
  [...content.replace(BLOCK_COMMENT, '').matchAll(VAR_DECLARATION)].flatMap(
    (m) => matchToVarEntry(m),
  );

export async function detectCssVars(
  projectRoot: string,
): Promise<CssVars | null> {
  const files = [...(await findCssFiles(projectRoot))].sort();
  if (files.length === 0) return null;

  const contents = await Promise.all(files.map((file) => readFileSafe(file)));
  const entries = contents
    .filter((c): c is string => c !== null)
    .flatMap((content) => extractVars(content));
  return Object.fromEntries(entries);
}
