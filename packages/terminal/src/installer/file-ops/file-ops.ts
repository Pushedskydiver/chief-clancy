/**
 * Low-level file system helpers for the installer.
 *
 * Provides SHA-256 hashing, recursive directory copying,
 * and workflow content inlining.
 */
import type { Dirent } from 'node:fs';

import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

/** Check if a path is a symlink (including dangling symlinks). */
const isSymlinkAt = (path: string): boolean => {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
};

/** Throw if the given path is a symlink. */
const rejectSymlink = (path: string): void => {
  if (isSymlinkAt(path)) {
    throw new Error(`${path} is a symlink. Remove it first before installing.`);
  }
};

/**
 * Compute the SHA-256 hash of a file.
 *
 * @param filePath - Absolute path to the file.
 * @returns The hex-encoded SHA-256 hash string.
 */
export const fileHash = (filePath: string): string => {
  const content = readFileSync(filePath);

  return createHash('sha256').update(content).digest('hex');
};

/** Copy a single directory entry from src to dest, recursing into subdirectories. */
const copyEntry =
  (src: string, dest: string) =>
  (entry: Dirent): void => {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
      return;
    }

    rejectSymlink(destPath);
    copyFileSync(srcPath, destPath);
  };

/**
 * Recursively copy a directory, throwing if any destination path is a symlink.
 *
 * Checks both the destination root and individual file paths for symlinks.
 * The source is trusted installer content and not checked.
 * Reads the source before creating the destination to avoid leaving empty
 * directories on failure.
 *
 * @param src - Source directory path.
 * @param dest - Destination directory path.
 * @throws If the destination is a symlink or the source does not exist.
 */
export const copyDir = (src: string, dest: string): void => {
  rejectSymlink(dest);

  const entries = readdirSync(src, { withFileTypes: true });

  mkdirSync(dest, { recursive: true });
  entries.forEach(copyEntry(src, dest));
};

/** Matches `@.claude/clancy/workflows/<filename>.md` on its own line (global). Disallows path separators. */
const WORKFLOW_REF = /^@\.claude\/clancy\/workflows\/([^/\\]+\.md)\r?$/gm;

/** Resolve a workflow @-file reference to its content, or return the original if missing. */
const resolveWorkflowRef = (
  workflowsDir: string,
  fullMatch: string,
  fileName: string,
): string => {
  const workflowFile = join(workflowsDir, fileName);
  const workflowExists = existsSync(workflowFile);

  if (!workflowExists) return fullMatch;

  return readFileSync(workflowFile, 'utf8');
};

/** Inline workflow references in a single command file. */
const inlineFileWorkflows =
  (commandsDir: string, workflowsDir: string) =>
  (file: string): void => {
    const isMarkdown = file.endsWith('.md');

    if (!isMarkdown) return;

    const cmdPath = join(commandsDir, file);
    const content = readFileSync(cmdPath, 'utf8');
    const resolved = content.replaceAll(
      WORKFLOW_REF,
      (match, fileName: string) =>
        resolveWorkflowRef(workflowsDir, match, fileName),
    );
    const hasChanges = resolved !== content;

    if (!hasChanges) return;

    rejectSymlink(cmdPath);
    writeFileSync(cmdPath, resolved);
  };

/**
 * Inline workflow content into command markdown files.
 *
 * For global installs, @-file references resolve relative to the project root
 * (not ~/.claude), so the workflow files won't be found at runtime. This
 * replaces matching `@.claude/clancy/workflows/<name>.md` references with the
 * actual workflow content. References to missing files are left unchanged.
 * Handles multiple references per file.
 *
 * @param commandsDir - The installed commands directory.
 * @param workflowsDir - The installed workflows directory.
 */
export const inlineWorkflows = (
  commandsDir: string,
  workflowsDir: string,
): void => {
  const files = readdirSync(commandsDir);
  files.forEach(inlineFileWorkflows(commandsDir, workflowsDir));
};
