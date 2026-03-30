import type { EnvFileSystem } from './env-parser.js';

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { loadClancyEnv, parseEnvContent } from './env-parser.js';

describe('parseEnvContent', () => {
  it('parses simple key=value pairs', () => {
    const result = parseEnvContent('FOO=bar\nBAZ=qux');
    expect(result).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('strips double quotes from values', () => {
    const result = parseEnvContent('KEY="value"');
    expect(result).toEqual({ KEY: 'value' });
  });

  it('strips single quotes from values', () => {
    const result = parseEnvContent("KEY='value'");
    expect(result).toEqual({ KEY: 'value' });
  });

  it('ignores blank lines', () => {
    const result = parseEnvContent('FOO=bar\n\nBAZ=qux\n');
    expect(result).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('ignores comment lines', () => {
    const result = parseEnvContent('# comment\nFOO=bar\n# another');
    expect(result).toEqual({ FOO: 'bar' });
  });

  it('ignores lines without =', () => {
    const result = parseEnvContent('FOO=bar\nINVALID_LINE\nBAZ=qux');
    expect(result).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('handles values with = in them', () => {
    const result = parseEnvContent('URL=https://example.com?foo=bar&baz=1');
    expect(result).toEqual({ URL: 'https://example.com?foo=bar&baz=1' });
  });

  it('handles empty values', () => {
    const result = parseEnvContent('KEY=');
    expect(result).toEqual({ KEY: '' });
  });

  it('trims whitespace around keys and values', () => {
    const result = parseEnvContent('  KEY  =  value  ');
    expect(result).toEqual({ KEY: 'value' });
  });

  it('returns mismatched quotes unchanged', () => {
    const result = parseEnvContent('KEY="value\'');
    expect(result).toEqual({ KEY: '"value\'' });
  });

  it('ignores lines with empty keys', () => {
    const result = parseEnvContent('=value\nKEY=val');
    expect(result).toEqual({ KEY: 'val' });
  });

  it('resolves duplicate keys to the last value', () => {
    const result = parseEnvContent('KEY=first\nKEY=second');
    expect(result).toEqual({ KEY: 'second' });
  });

  it('handles a realistic .env file', () => {
    const content = [
      '# Jira configuration',
      'JIRA_BASE_URL=https://example.atlassian.net',
      'JIRA_USER=user@example.com',
      'JIRA_API_TOKEN="my-secret-token"',
      'JIRA_PROJECT_KEY=PROJ',
      '',
      '# Optional',
      "CLANCY_STATUS_IN_PROGRESS='In Progress'",
      'CLANCY_STATUS_DONE=Done',
    ].join('\n');

    const result = parseEnvContent(content);

    expect(result).toEqual({
      JIRA_BASE_URL: 'https://example.atlassian.net',
      JIRA_USER: 'user@example.com',
      JIRA_API_TOKEN: 'my-secret-token',
      JIRA_PROJECT_KEY: 'PROJ',
      CLANCY_STATUS_IN_PROGRESS: 'In Progress',
      CLANCY_STATUS_DONE: 'Done',
    });
  });

  it('returns empty object for empty string', () => {
    expect(parseEnvContent('')).toEqual({});
  });
});

describe('parseEnvContent (property-based)', () => {
  const envKey = fc.stringMatching(/^[A-Z_][A-Z0-9_]{0,19}$/);

  const envValue = fc
    .string({ maxLength: 50 })
    .filter((s) => !s.includes('\n') && !s.includes('\r'));

  const stripQuotes = (s: string): string => {
    if (s.length < 2) return s;

    const isDouble = s.startsWith('"') && s.endsWith('"');
    const isSingle = s.startsWith("'") && s.endsWith("'");

    return isDouble || isSingle ? s.slice(1, -1) : s;
  };

  it('round-trips key=value pairs (values trimmed and unquoted)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(envKey, envValue), { minLength: 1, maxLength: 10 }),
        (entries) => {
          const content = entries.map(([k, v]) => `${k}=${v}`).join('\n');
          const result = parseEnvContent(content);

          const expected = Object.fromEntries(
            entries.map(([k, v]) => [k, stripQuotes(v.trim())]),
          );
          expect(result).toEqual(expected);
        },
      ),
    );
  });

  it('never produces undefined values in the output record', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (content) => {
        const result = parseEnvContent(content);
        const values = Object.values(result);

        expect(values.every((v) => typeof v === 'string')).toBe(true);
      }),
    );
  });

  it('keys in output are always trimmed', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(envKey, envValue), { minLength: 1, maxLength: 10 }),
        (entries) => {
          const content = entries
            .map(([k, v]) => `  ${k}  =  ${v}  `)
            .join('\n');
          const result = parseEnvContent(content);

          expect(Object.keys(result).every((k) => k === k.trim())).toBe(true);
        },
      ),
    );
  });
});

describe('loadClancyEnv', () => {
  it('returns parsed env when file exists', () => {
    const fs: EnvFileSystem = {
      readFile: () => 'FOO=bar\nBAZ=qux',
    };

    expect(loadClancyEnv('/project', fs)).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('returns undefined when readFile throws', () => {
    const fs: EnvFileSystem = {
      readFile: () => {
        throw new Error('ENOENT');
      },
    };

    expect(loadClancyEnv('/project', fs)).toBeUndefined();
  });

  it('reads from .clancy/.env under the project root', () => {
    let readPath = '';

    const fs: EnvFileSystem = {
      readFile: (path) => {
        readPath = path;
        return 'KEY=val';
      },
    };

    loadClancyEnv('/my/project', fs);

    expect(readPath).toBe('/my/project/.clancy/.env');
  });

  it('normalises trailing slashes from projectRoot', () => {
    let readPath = '';

    const fs: EnvFileSystem = {
      readFile: (path) => {
        readPath = path;
        return 'KEY=val';
      },
    };

    loadClancyEnv('/my/project/', fs);

    expect(readPath).toBe('/my/project/.clancy/.env');
  });
});
