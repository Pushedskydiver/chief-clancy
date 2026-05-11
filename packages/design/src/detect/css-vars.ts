/**
 * CSS custom-property detection — Phase F slice 3.
 *
 * Recursively scans a project root for `*.css` files and extracts top-level
 * `--<name>: <value>` declarations into a flat last-wins map. Scope-bound
 * variables (e.g. `:root` vs `.dark`) are not differentiated at this slice;
 * slice 6 schema may revisit. Multi-line values are out of scope — the regex
 * stops at the first `;` or `}` on the declaration's line. Comments are not
 * stripped, so a `/* --fake: x; * /` inside a block comment would false-match;
 * unobserved in real-world stylesheets, documented as a known limitation.
 *
 * Directory exclusions (`node_modules`, `dist`, `.git`, `build`, `.next`,
 * `.turbo`) match Tailwind's content-scanner defaults for the same reason —
 * those trees are vendored, generated, or version-control internals and
 * carry no design-token authorship signal.
 *
 * Files are sorted alphabetically before aggregation so last-wins becomes
 * deterministic across filesystems (raw `readdir` order is unspecified).
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

const VAR_DECLARATION = /--([\w-]+)\s*:\s*([^;}]+?)\s*(?:;|$)/gm;

const readDirSafe = async (
  dir: string,
): Promise<readonly { readonly name: string; readonly isDir: boolean }[]> => {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.map((e) => ({ name: e.name, isDir: e.isDirectory() }));
  } catch {
    return [];
  }
};

const findCssFiles = async (dir: string): Promise<readonly string[]> => {
  const entries = await readDirSafe(dir);
  const localCss = entries
    .filter((e) => !e.isDir && e.name.endsWith('.css'))
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
  [...content.matchAll(VAR_DECLARATION)].flatMap((m) => matchToVarEntry(m));

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
