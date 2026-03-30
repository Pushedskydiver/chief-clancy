/**
 * Post-processing script for changesets-generated CHANGELOG.md files.
 *
 * Reads each package's CHANGELOG.md, detects gitmoji prefixes on bullet
 * entries, and regroups them under category headers. Run after
 * `changeset version` to produce the grouped format.
 *
 * Usage: tsx scripts/group-changelog.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Gitmoji → category mapping (matches docs/GIT.md)
// ---------------------------------------------------------------------------

const CATEGORIES: ReadonlyArray<{
  readonly emoji: string;
  readonly heading: string;
}> = [
  { emoji: '✨', heading: '### ✨ Features' },
  { emoji: '🐛', heading: '### 🐛 Fixes' },
  { emoji: '♻️', heading: '### ♻️ Refactors' },
  { emoji: '✅', heading: '### ✅ Tests' },
  { emoji: '📝', heading: '### 📝 Docs' },
  { emoji: '📦', heading: '### 📦 Chores' },
  { emoji: '⚡️', heading: '### ⚡️ Performance' },
  { emoji: '💄', heading: '### 💄 Style' },
  { emoji: '🔒', heading: '### 🔒 Security' },
  { emoji: '🔥', heading: '### 🔥 Removals' },
];

// ---------------------------------------------------------------------------
// Changelog processing
// ---------------------------------------------------------------------------

/**
 * Detect which category a bullet line belongs to by its gitmoji prefix.
 * Returns the category index, or -1 for uncategorised lines.
 */
function detectCategory(line: string): number {
  const trimmed = line.replace(/^-\s*/, '').trim();
  return CATEGORIES.findIndex(({ emoji }) => trimmed.startsWith(emoji));
}

/**
 * Group bullet entries within a single version section under gitmoji headers.
 *
 * Preserves non-bullet content (headings, blank lines, paragraphs) as-is.
 * Only regroups top-level bullet lines (`- ...`) that start with a gitmoji.
 */
function groupVersionSection(lines: readonly string[]): string[] {
  const buckets: string[][] = CATEGORIES.map(() => []);
  const uncategorised: string[] = [];
  const preamble: string[] = [];
  let inBullets = false;
  let activeBucket: string[] | null = null;

  for (const line of lines) {
    const isBullet = /^- /.test(line);

    if (!inBullets && !isBullet) {
      preamble.push(line);
      continue;
    }

    inBullets = true;

    if (!isBullet) {
      // Continuation line (indented under a bullet) — append to active bucket
      if (activeBucket) activeBucket.push(line);
      continue;
    }

    const idx = detectCategory(line);
    if (idx >= 0) {
      buckets[idx].push(line);
      activeBucket = buckets[idx];
    } else {
      uncategorised.push(line);
      activeBucket = uncategorised;
    }
  }

  // If nothing was categorised, return as-is
  const hasCategorised = buckets.some((b) => b.length > 0);
  if (!hasCategorised) return [...lines];

  const result = [...preamble];

  for (let i = 0; i < CATEGORIES.length; i++) {
    if (buckets[i].length === 0) continue;
    result.push('', CATEGORIES[i].heading, '');
    result.push(...buckets[i]);
  }

  if (uncategorised.length > 0) {
    result.push('', '### Other', '');
    result.push(...uncategorised);
  }

  return result;
}

/**
 * Process a CHANGELOG.md file: split into version sections, group each, rejoin.
 */
function processChangelog(content: string): string {
  const lines = content.split('\n');
  const sections: { heading: string; body: string[] }[] = [];
  const header: string[] = [];
  let current: { heading: string; body: string[] } | null = null;

  for (const line of lines) {
    if (/^## /.test(line)) {
      if (current) sections.push(current);
      current = { heading: line, body: [] };
    } else if (current) {
      current.body.push(line);
    } else {
      header.push(line);
    }
  }

  if (current) sections.push(current);

  const output = [...header];

  for (const section of sections) {
    output.push(section.heading);
    output.push(...groupVersionSection(section.body));
  }

  return output.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const CHANGELOG_PATHS = [
  'packages/core/CHANGELOG.md',
  'packages/terminal/CHANGELOG.md',
  'packages/chief-clancy/CHANGELOG.md',
];

const root = join(import.meta.dirname, '..');
let processed = 0;

for (const rel of CHANGELOG_PATHS) {
  const abs = join(root, rel);
  try {
    const content = readFileSync(abs, 'utf8');
    const grouped = processChangelog(content);
    if (grouped !== content) {
      writeFileSync(abs, grouped, 'utf8');
      processed++;
      console.log(`  Grouped: ${rel}`);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

console.log(`  ${processed} changelog(s) updated.`);
