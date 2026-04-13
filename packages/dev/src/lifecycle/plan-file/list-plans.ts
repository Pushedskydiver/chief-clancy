/**
 * List plan files in a directory with approval status.
 *
 * Returns all `.md` plan files, naturally sorted by filename,
 * with a boolean indicating whether each has an `.approved` marker.
 * Used by batch mode (`--from {directory} --afk`) to queue plans.
 */
import { join } from 'node:path';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Filesystem operations needed for listing plan files. */
type ListPlansFs = {
  readonly readdir: (path: string) => readonly string[];
  readonly exists: (path: string) => boolean;
};

/** A plan file entry with its approval status. */
type PlanFileEntry = {
  readonly path: string;
  readonly slug: string;
  readonly approved: boolean;
};

// ─── Public ─────────────────────────────────────────────────────────────────

/**
 * List `.md` plan files in a directory with approval status.
 *
 * Files are naturally sorted by filename (numeric-aware) so that
 * `slug-1.md`, `slug-2.md`, `slug-10.md` sort correctly.
 *
 * @param directory - Path to the directory containing plan files.
 * @param fs - Filesystem operations for reading the directory.
 * @returns Plan file entries, naturally sorted, with approval status.
 */
function listPlanFiles(
  directory: string,
  fs: ListPlansFs,
): readonly PlanFileEntry[] {
  const files = fs.readdir(directory).filter((f) => f.endsWith('.md'));

  const sorted = files.toSorted((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );

  return sorted.map((file) => {
    const slug = file.replace(/\.md$/, '');
    const path = join(directory, file);
    const markerPath = path.replace(/\.md$/, '.approved');

    return {
      path,
      slug,
      approved: fs.exists(markerPath),
    };
  });
}

export { listPlanFiles };
export type { ListPlansFs, PlanFileEntry };
