/**
 * Atomic write helper — write-temp-rename with mkdir.
 *
 * All dev artifact writers use this to avoid partial writes on crash.
 * See plan §4.3 for the artifact file layout.
 */
import { basename, dirname, extname, join } from 'node:path';

// ─── Types ─────────────────────────────────────────────────────────────────

type AtomicFs = {
  readonly mkdir: (path: string) => void;
  readonly writeFile: (path: string, content: string) => void;
  readonly rename: (from: string, to: string) => void;
  readonly readdir: (path: string) => readonly string[];
  readonly unlink: (path: string) => void;
  readonly stat: (path: string) => { readonly mtimeMs: number } | undefined;
};

type RotateOpts = {
  readonly fs: AtomicFs;
  readonly filePath: string;
  readonly keep: number;
  readonly timestamp: () => string;
};

// ─── Atomic write ──────────────────────────────────────────────────────────

function atomicWrite(fs: AtomicFs, filePath: string, content: string): void {
  const dir = dirname(filePath);
  const tmp = `${filePath}.tmp`;

  fs.mkdir(dir);
  fs.writeFile(tmp, content);
  fs.rename(tmp, filePath);
}

// ─── File rotation ─────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rotate an existing file by renaming it with a timestamp suffix.
 * Deletes oldest rotated files when the count exceeds `keep`.
 */
function rotateFile(opts: RotateOpts): void {
  const { fs, filePath, keep, timestamp } = opts;

  if (keep <= 0) return;
  if (!fs.stat(filePath)) return;

  const dir = dirname(filePath);
  const ext = extname(filePath);
  const stem = basename(filePath, ext);

  const rotatedName = `${stem}.${timestamp()}${ext}`;
  fs.rename(filePath, join(dir, rotatedName));

  const rotatedPattern = new RegExp(
    `^${escapeRegex(stem)}\\.\\d{4}-\\d{2}-\\d{2}T[\\d.-]+${escapeRegex(ext)}$`,
  );
  // Invariant: ISO-like timestamps (YYYY-MM-DDTHH-MM-SS.mmm) sort lexicographically
  // in chronological order, so .sort() gives oldest-first for deletion.
  const existing = fs
    .readdir(dir)
    .filter((f) => rotatedPattern.test(f))
    .slice()
    .sort();

  const excess = existing.length - keep;
  existing
    .slice(0, Math.max(0, excess))
    .forEach((f) => fs.unlink(join(dir, f)));
}

// ─── Exports ───────────────────────────────────────────────────────────────

export { atomicWrite, rotateFile };
export type { AtomicFs };
