/**
 * Clancy .env file parser.
 *
 * Reads key=value pairs from `.clancy/.env` files. Supports quoted values,
 * comments, and blank lines. No third-party dependencies.
 */
import { join } from 'node:path';

/**
 * Strip surrounding quotes from a value string.
 *
 * Removes matched single or double quotes. Values shorter than 2 characters
 * or with mismatched quotes are returned unchanged.
 *
 * @param value - The raw value string.
 * @returns The value with surrounding quotes removed.
 */
const stripQuotes = (value: string): string => {
  if (value.length < 2) return value;

  const first = value[0];
  const last = value[value.length - 1];
  const isDoubleQuoted = first === '"' && last === '"';
  const isSingleQuoted = first === "'" && last === "'";

  if (isDoubleQuoted || isSingleQuoted) {
    return value.slice(1, -1);
  }

  return value;
};

/**
 * Parse a single .env line into a key-value tuple, or undefined if invalid.
 *
 * @param line - A single line from a .env file.
 * @returns A [key, value] tuple, or undefined for blank/comment/invalid lines.
 */
const parseLine = (line: string): readonly [string, string] | undefined => {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith('#')) return undefined;

  const eqIndex = trimmed.indexOf('=');

  if (eqIndex === -1) return undefined;

  const key = trimmed.slice(0, eqIndex).trim();

  if (!key) return undefined;

  const value = stripQuotes(trimmed.slice(eqIndex + 1).trim());

  return [key, value] as const;
};

/** Type guard to filter out undefined entries from parsed lines. */
const isDefined = (
  entry: readonly [string, string] | undefined,
): entry is readonly [string, string] => entry !== undefined;

/**
 * Parse a .env file content string into a key-value record.
 *
 * Handles single-quoted, double-quoted, and unquoted values.
 * Ignores blank lines and lines starting with `#`. Does not process
 * escape sequences (e.g. `\"` within quoted values). Duplicate keys
 * resolve to the last value.
 *
 * @param content - The raw .env file content.
 * @returns A record of environment variable key-value pairs.
 *
 * @example
 * ```ts
 * parseEnvContent('JIRA_BASE_URL=https://example.atlassian.net\nJIRA_USER=user@example.com');
 * // { JIRA_BASE_URL: 'https://example.atlassian.net', JIRA_USER: 'user@example.com' }
 * ```
 */
export const parseEnvContent = (content: string): Record<string, string> => {
  const lines = content.split('\n');
  const entries = lines.map(parseLine).filter(isDefined);

  return Object.fromEntries(entries);
};

/** File system operations required by {@link loadClancyEnv}. */
export type EnvFileSystem = {
  readonly exists: (path: string) => boolean;
  readonly readFile: (path: string) => string;
};

/**
 * Load environment variables from a `.clancy/.env` file.
 *
 * @param projectRoot - The root directory of the project containing `.clancy/`.
 * @param fs - File system operations (injected for testability).
 * @returns The parsed environment variables, or `undefined` if the file doesn't exist.
 *
 * @example
 * ```ts
 * import { existsSync, readFileSync } from 'node:fs';
 *
 * const env = loadClancyEnv('/path/to/project', {
 *   exists: existsSync,
 *   readFile: (p) => readFileSync(p, 'utf8'),
 * });
 * ```
 */
export const loadClancyEnv = (
  projectRoot: string,
  fs: EnvFileSystem,
): Record<string, string> | undefined => {
  const envPath = join(projectRoot, '.clancy', '.env');

  if (!fs.exists(envPath)) return undefined;

  return parseEnvContent(fs.readFile(envPath));
};
