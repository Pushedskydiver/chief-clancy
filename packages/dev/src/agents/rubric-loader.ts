/**
 * Load the readiness rubric markdown at runtime.
 *
 * Reads readiness.md from the same directory as this module.
 * Works in both tsc output (reads from dist/agents/) and esbuild
 * bundle (inlined by esbuild's file resolution).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RUBRIC_DIR = fileURLToPath(new URL('.', import.meta.url));

/**
 * Load the readiness rubric content.
 *
 * @returns The rubric markdown as a string.
 * @throws If readiness.md is not found.
 */
export function loadRubric(): string {
  return readFileSync(join(RUBRIC_DIR, 'readiness.md'), 'utf8');
}
