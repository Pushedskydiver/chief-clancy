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
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { hasErrorCode } from '~/t/installer/shared/fs-errors/fs-errors.js';
import { rejectSymlink } from '~/t/installer/shared/fs-guards/fs-guards.js';

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

    if (!entry.isFile()) return; // Skip symlinks, FIFOs, sockets, etc.

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
 * @returns Nothing — throws on symlink or missing source.
 */
export const copyDir = (src: string, dest: string): void => {
  rejectSymlink(dest);

  const entries = readdirSync(src, { withFileTypes: true });

  mkdirSync(dest, { recursive: true });
  entries.forEach(copyEntry(src, dest));
};

/** Matches `@.claude/clancy/workflows/<filename>.md` on its own line. Disallows path separators. */
const WORKFLOW_REF = /^@\.claude\/clancy\/workflows\/([^/\\]+\.md)\r?$/gm;

/** Resolve a workflow @-file reference to its content, or return the original if missing. */
const resolveWorkflowRef = (
  workflowsDir: string,
  fullMatch: string,
  fileName: string,
): string => {
  const workflowFile = join(workflowsDir, fileName);

  try {
    rejectSymlink(workflowFile);

    return readFileSync(workflowFile, 'utf8');
  } catch (error: unknown) {
    if (hasErrorCode(error, 'ENOENT')) return fullMatch;

    throw error;
  }
};

/** Inline workflow references in a single command file. */
const inlineFileWorkflows =
  (commandsDir: string, workflowsDir: string) =>
  (entry: Dirent): void => {
    const isMarkdownFile = entry.isFile() && entry.name.endsWith('.md');

    if (!isMarkdownFile) return;

    const cmdPath = join(commandsDir, entry.name);
    const content = readFileSync(cmdPath, 'utf8');
    const resolved = content.replace(WORKFLOW_REF, (match, fileName: string) =>
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
 * @returns Nothing — files are modified in place.
 */
export const inlineWorkflows = (
  commandsDir: string,
  workflowsDir: string,
): void => {
  rejectSymlink(commandsDir);
  rejectSymlink(workflowsDir);

  const entries = readdirSync(commandsDir, { withFileTypes: true });
  entries.forEach(inlineFileWorkflows(commandsDir, workflowsDir));
};
