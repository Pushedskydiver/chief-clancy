/**
 * Element-state persistence — Phase F (UI-vision rework, slice A1).
 *
 * Mutable per-element session state at `<sessionDir>/elements/<slot>.json`
 * (spec §2.8): rounds, per-variant lock + status, soft-selection, and the
 * accept pointer. Unlike the append-only JSONL surfaces (chat/threads),
 * this file is OVERWRITTEN wholesale on every state change —
 * `writeElementState` replaces it, it never appends.
 *
 * Reads validate against `elementStateSchema` (untrusted disk data);
 * `readElementState` returns `null` when no state has been written for the
 * slot yet. Mirrors `storage/approve.ts`'s caller-owns-`sessionDir`
 * contract with a slot-path-traversal guard, since `slot` derives from a
 * stable-selector key that isn't charset-restricted.
 */
import type { ElementState } from '../schemas/element-state.js';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';

import { elementStateSchema } from '../schemas/element-state.js';

const ELEMENTS_DIR = 'elements';

/**
 * Resolve `<sessionDir>/elements/<slot>.json`, rejecting a `slot` shaped to
 * escape the elements dir via path traversal.
 */
function elementPath(sessionDir: string, slot: string): string {
  const dir = join(sessionDir, ELEMENTS_DIR);
  const path = join(dir, `${slot}.json`);
  const rel = relative(resolve(dir), resolve(path));
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(
      `element storage: slot "${slot}" resolves outside the elements dir`,
    );
  }
  return path;
}

export async function writeElementState(
  sessionDir: string,
  slot: string,
  state: ElementState,
): Promise<void> {
  const path = elementPath(sessionDir, slot);
  await mkdir(join(sessionDir, ELEMENTS_DIR), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

export async function readElementState(
  sessionDir: string,
  slot: string,
): Promise<ElementState | null> {
  const path = elementPath(sessionDir, slot);

  const raw = await readFile(path, 'utf8').catch(
    (error: NodeJS.ErrnoException): string | null => {
      if (error.code === 'ENOENT') return null;
      throw error;
    },
  );
  if (raw === null) return null;

  return elementStateSchema.parse(JSON.parse(raw));
}
