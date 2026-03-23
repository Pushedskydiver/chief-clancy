/**
 * Manifest-based change detection for installed files.
 *
 * Tracks SHA-256 hashes of installed files so that user modifications can
 * be detected and backed up before an update overwrites them.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { fileHash } from '~/installer/file-ops/file-ops.js';

/** A file that has been modified by the user since last install. */
type ModifiedFile = { readonly rel: string; readonly absPath: string };

/** Check whether a resolved path stays within a base directory. */
function isInsideBase(base: string, target: string): boolean {
  const resolved = resolve(target);
  return resolved.startsWith(`${resolve(base)}/`) || resolved === resolve(base);
}

/**
 * Recursively collect file entries as `[relativePath, hash]` pairs.
 *
 * Pure recursive function — no mutable closure. Skips symlinks to
 * prevent traversal outside the install tree.
 */
function collectEntries(
  dir: string,
  prefix: string,
): readonly (readonly [string, string])[] {
  const entries = readdirSync(dir, { withFileTypes: true });

  return entries.flatMap((entry) => {
    if (entry.isSymbolicLink()) return [];

    const full = join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      return collectEntries(full, rel);
    }

    return [[rel, fileHash(full)] as const];
  });
}

/**
 * Build a manifest of installed files with SHA-256 hashes.
 *
 * Recursively walks a directory and records the hash of every file.
 * Symlinks are skipped to prevent traversal outside the install tree.
 *
 * @param baseDir - Root directory to scan.
 * @returns A record mapping relative paths to their SHA-256 hashes.
 */
export function buildManifest(baseDir: string): Record<string, string> {
  return Object.fromEntries(collectEntries(baseDir, ''));
}

/** Safely parse manifest JSON, filtering out non-string values. */
function parseManifestJson(raw: string): Record<string, string> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(record).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
  } catch {
    return null;
  }
}

/** Try to hash a file, returning `null` if it no longer exists. */
function safeFileHash(filePath: string): string | null {
  try {
    return fileHash(filePath);
  } catch (err: unknown) {
    const isNotFound =
      err instanceof Error && 'code' in err && err.code === 'ENOENT';
    if (isNotFound) return null;
    throw err;
  }
}

/**
 * Detect files modified by the user since last install.
 *
 * Compares current file hashes against the stored manifest to find changes.
 * Manifest keys containing path traversal sequences are rejected.
 *
 * @param baseDir - The installed directory to check.
 * @param manifestPath - Path to the stored manifest JSON.
 * @returns Array of modified file records with relative and absolute paths.
 */
export function detectModifiedFiles(
  baseDir: string,
  manifestPath: string,
): readonly ModifiedFile[] {
  if (!existsSync(manifestPath)) return [];

  const manifest = parseManifestJson(readFileSync(manifestPath, 'utf8'));
  if (manifest === null) return [];

  return Object.entries(manifest)
    .filter(([rel, hash]) => {
      const absPath = join(baseDir, rel);
      if (!isInsideBase(baseDir, absPath)) return false;
      const currentHash = safeFileHash(absPath);
      return currentHash !== null && currentHash !== hash;
    })
    .map(([rel]) => ({ rel, absPath: join(baseDir, rel) }));
}

/** Try to copy a file, silently skipping if it no longer exists. */
function safeCopy(src: string, dest: string): void {
  try {
    copyFileSync(src, dest);
  } catch (err: unknown) {
    const isNotFound =
      err instanceof Error && 'code' in err && err.code === 'ENOENT';
    if (isNotFound) return;
    throw err;
  }
}

/**
 * Back up modified files to a patches directory.
 *
 * Copies each modified file and writes a `backup-meta.json` with metadata.
 * Files that vanish between detection and backup are silently skipped.
 *
 * @param modified - Array of modified file records.
 * @param patchesDir - Directory to store backups.
 * @returns The patches directory path, or `null` if no files were backed up.
 */
export function backupModifiedFiles(
  modified: readonly ModifiedFile[],
  patchesDir: string,
): string | null {
  if (modified.length === 0) return null;

  mkdirSync(patchesDir, { recursive: true });

  modified.forEach(({ rel, absPath }) => {
    const backupPath = join(patchesDir, rel);
    mkdirSync(dirname(backupPath), { recursive: true });
    safeCopy(absPath, backupPath);
  });

  const meta = JSON.stringify(
    { backed_up: modified.map((m) => m.rel), date: new Date().toISOString() },
    null,
    2,
  );
  writeFileSync(join(patchesDir, 'backup-meta.json'), meta);

  return patchesDir;
}
