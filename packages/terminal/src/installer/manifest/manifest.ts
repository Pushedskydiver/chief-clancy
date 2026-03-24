/**
 * Manifest-based change detection for installed files.
 *
 * Tracks SHA-256 hashes of installed files so that user modifications can
 * be detected and backed up before an update overwrites them.
 */

import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { fileHash } from '~/t/installer/file-ops/file-ops.js';

/** A file that has been modified by the user since last install. */
type ModifiedFile = { readonly rel: string; readonly absPath: string };

/** Check whether a resolved path stays within a base directory. */
function isInsideBase(base: string, target: string): boolean {
  const rel = relative(resolve(base), resolve(target));
  const escapesBase = rel === '..' || rel.startsWith(`..${sep}`);
  return rel !== '' && !escapesBase && !isAbsolute(rel);
}

/** Reject paths with traversal segments, backslashes, or absolute prefixes. */
function isSafeRelativePath(rel: string): boolean {
  if (rel === '' || rel.includes('\\')) return false;
  if (isAbsolute(rel)) return false;
  const segments = rel.split('/');
  return segments.every((s) => s !== '.' && s !== '..');
}

/** Check whether an error is a file-not-found (ENOENT). */
function isEnoent(err: unknown): boolean {
  if (!(err instanceof Error) || !('code' in err)) return false;
  return (err as { readonly code?: unknown }).code === 'ENOENT';
}

/** Resolve a single directory entry into `[rel, hash]` pairs. */
function entryToPairs(
  entry: {
    readonly isSymbolicLink: () => boolean;
    readonly isDirectory: () => boolean;
    readonly isFile: () => boolean;
    readonly name: string;
  },
  dir: string,
  prefix: string,
): readonly (readonly [string, string])[] {
  if (entry.isSymbolicLink()) return [];

  const full = join(dir, entry.name);
  const rel = prefix ? `${prefix}/${entry.name}` : entry.name;

  if (entry.isDirectory()) return collectEntries(full, rel);
  if (!entry.isFile()) return [];

  return [[rel, fileHash(full)] as const];
}

/**
 * Recursively collect file entries as `[relativePath, hash]` pairs.
 *
 * Pure recursive function — no mutable closure. Skips symlinks and
 * non-file entries (FIFO, socket, etc.) to prevent unexpected behaviour.
 */
function collectEntries(
  dir: string,
  prefix: string,
): readonly (readonly [string, string])[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => entryToPairs(entry, dir, prefix));
}

/**
 * Build a manifest of installed files with SHA-256 hashes.
 *
 * Recursively walks a directory and records the hash of every file.
 * Symlinks and non-file entries are skipped.
 *
 * @param baseDir - Root directory to scan.
 * @returns A record mapping relative paths to their SHA-256 hashes.
 */
export function buildManifest(baseDir: string): Record<string, string> {
  return Object.fromEntries(collectEntries(resolve(baseDir), ''));
}

/** Check whether a value looks like a plain object (not array, not null). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Keep only entries where the value is a string. */
function stringValuesOnly(
  record: Record<string, unknown>,
): Record<string, string> {
  const stringEntries = Object.entries(record).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );
  return Object.fromEntries(stringEntries);
}

/** Safely parse manifest JSON, filtering out non-string values. */
function parseManifestJson(raw: string): Record<string, string> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return null;
    return stringValuesOnly(parsed);
  } catch {
    return null;
  }
}

/** Try to read and parse a manifest file, returning `null` on any failure. */
function readManifest(manifestPath: string): Record<string, string> | null {
  try {
    return parseManifestJson(readFileSync(manifestPath, 'utf8'));
  } catch (err: unknown) {
    if (isEnoent(err)) return null;
    throw err;
  }
}

/** Try to hash a file, returning `null` if it no longer exists. */
function safeFileHash(filePath: string): string | null {
  try {
    return fileHash(filePath);
  } catch (err: unknown) {
    if (isEnoent(err)) return null;
    throw err;
  }
}

/** Check whether a manifest entry has been modified on disk. */
function isModified(baseDir: string, rel: string, hash: string): boolean {
  if (!isSafeRelativePath(rel)) return false;

  const absPath = join(baseDir, rel);
  if (!isInsideBase(baseDir, absPath)) return false;

  const currentHash = safeFileHash(absPath);
  return currentHash !== null && currentHash !== hash;
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
  const manifest = readManifest(manifestPath);
  if (manifest === null) return [];

  const resolvedBase = resolve(baseDir);

  return Object.entries(manifest)
    .filter(([rel, hash]) => isModified(resolvedBase, rel, hash))
    .map(([rel]) => ({ rel, absPath: join(resolvedBase, rel) }));
}

/**
 * Try to copy a file, silently skipping if it no longer exists.
 *
 * @returns `true` if the copy succeeded, `false` if the source was missing.
 */
function safeCopy(src: string, dest: string): boolean {
  try {
    copyFileSync(src, dest);
    return true;
  } catch (err: unknown) {
    if (isEnoent(err)) return false;
    throw err;
  }
}

/** Copy a single modified file into the patches directory, returning its rel path on success. */
function copyToPatches(
  entry: ModifiedFile,
  patchesDir: string,
): readonly string[] {
  if (!isSafeRelativePath(entry.rel)) return [];
  const backupPath = join(patchesDir, entry.rel);
  if (!isInsideBase(patchesDir, backupPath)) return [];
  mkdirSync(dirname(backupPath), { recursive: true });
  return safeCopy(entry.absPath, backupPath) ? [entry.rel] : [];
}

/**
 * Back up modified files to a patches directory.
 *
 * Copies each modified file and writes a `backup-meta.json` with metadata.
 * Files that vanish between detection and backup are silently skipped.
 * Paths that escape the patches directory are rejected.
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

  const copiedPaths = modified.flatMap((entry) =>
    copyToPatches(entry, patchesDir),
  );

  if (copiedPaths.length === 0) return null;

  const backupMeta = {
    backed_up: copiedPaths,
    date: new Date().toISOString(),
  };

  writeFileSync(
    join(patchesDir, 'backup-meta.json'),
    JSON.stringify(backupMeta, null, 2),
  );

  return patchesDir;
}
