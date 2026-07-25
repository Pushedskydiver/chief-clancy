/**
 * Element-state persistence — Phase F (UI-vision rework, slice A1).
 *
 * Mutable per-element session state at `<sessionDir>/elements/<slot>.json`
 * (spec §2.8): rounds, per-variant lock + status, soft-selection, and the
 * accept pointer. `writeElementState` replaces the file, it never appends. See
 * `./README.md` for how this module's choices sit against its siblings'.
 *
 * `readElementState` returns `null` only when no state has been written for the
 * slot yet (ENOENT). The `accepted` pointer's `ts` arrives on the record from
 * the caller, since one accept event stamps this file and the marker together.
 *
 * `slot` derives from a stable-selector key and so cannot be held to an id
 * charset — it is guarded by containment instead. Note the guard's prefix test
 * rejects contained names beginning with two dots (`..foo`), which the appended
 * `.json` would otherwise make ordinary filenames.
 */
import type { ElementState } from '../schemas/element-state.js';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

import { z } from 'zod/mini';

import { elementStateSchema } from '../schemas/element-state.js';
import { isNodeFsError } from './fs-errors.js';

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
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

export async function readElementState(
  sessionDir: string,
  slot: string,
): Promise<ElementState | null> {
  const path = elementPath(sessionDir, slot);

  const raw = await readFile(path, 'utf8').catch(
    (err: unknown): string | null => {
      if (isNodeFsError(err) && err.code === 'ENOENT') return null;
      throw err;
    },
  );
  if (raw === null) return null;

  return z.parse(elementStateSchema, JSON.parse(raw));
}
