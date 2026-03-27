import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  extractContent,
  isAllowedPath,
  scanForCredentials,
} from './scan-credentials.js';

/** Build a fake credential string at runtime to avoid hook detection. */
function fakeKey(prefix: string, length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij0123456789';
  const body = Array.from({ length }, (_, i) => chars[i % chars.length]);

  return prefix + body.join('');
}

// ---------------------------------------------------------------------------
// scanForCredentials
// ---------------------------------------------------------------------------

describe('scanForCredentials', () => {
  it('detects a generic API key assignment', () => {
    const content = `const ${'api' + '_key'} = "${fakeKey('', 25)}"`;
    expect(scanForCredentials(content)).toContain('Generic API key');
  });

  it('detects a generic secret assignment', () => {
    const content = `${'secret'} = "${fakeKey('', 25)}"`;
    expect(scanForCredentials(content)).toContain('Generic secret');
  });

  it('detects a generic token assignment', () => {
    const content = `${'auth' + '_token'}: "${fakeKey('', 25)}"`;
    expect(scanForCredentials(content)).toContain('Generic token');
  });

  it('detects a generic password assignment', () => {
    const content = `${'password'} = "myP@ssw0rd!"`;
    expect(scanForCredentials(content)).toContain('Generic password');
  });

  it('detects an AWS access key', () => {
    const content = fakeKey('AKIA', 16);
    expect(scanForCredentials(content)).toContain('AWS Access Key');
  });

  it('detects an AWS secret key', () => {
    const label = ['aws', 'secret', 'access', 'key'].join('_');
    const content = `${label} = "${fakeKey('', 40)}"`;
    expect(scanForCredentials(content)).toContain('AWS Secret Key');
  });

  it('detects a GitHub PAT (classic)', () => {
    const content = fakeKey('ghp_', 36);
    expect(scanForCredentials(content)).toContain('GitHub PAT (classic)');
  });

  it('detects a GitHub PAT (fine-grained)', () => {
    const content = fakeKey('github_pat_', 82);
    expect(scanForCredentials(content)).toContain('GitHub PAT (fine-grained)');
  });

  it('detects a GitHub OAuth token', () => {
    const content = fakeKey('gho_', 36);
    expect(scanForCredentials(content)).toContain('GitHub OAuth token');
  });

  it('detects a Slack token', () => {
    const content = ['xoxb', '1234567890', 'abcdef'].join('-');
    expect(scanForCredentials(content)).toContain('Slack token');
  });

  it('detects a Stripe key', () => {
    const content = fakeKey('sk_live_', 24);
    expect(scanForCredentials(content)).toContain('Stripe key');
  });

  it('detects a private key header', () => {
    const content = ['-----BEGIN', 'RSA', 'PRIVATE KEY-----'].join(' ');
    expect(scanForCredentials(content)).toContain('Private key');
  });

  it('detects an Atlassian API token', () => {
    const label = ['jira', 'api', 'token'].join('_');
    const content = `${label} = "${fakeKey('', 24)}"`;
    expect(scanForCredentials(content)).toContain('Atlassian API token');
  });

  it('detects a Linear API key', () => {
    const content = fakeKey('lin_api_', 40);
    expect(scanForCredentials(content)).toContain('Linear API key');
  });

  it('detects a database connection string', () => {
    const content = ['postgres', '://admin:secret@localhost:5432/db'].join('');
    expect(scanForCredentials(content)).toContain('Database connection string');
  });

  it('returns empty array for safe content', () => {
    const content = 'const greeting = "hello world";';
    expect(scanForCredentials(content)).toStrictEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(scanForCredentials('')).toStrictEqual([]);
  });

  it('returns multiple matches when content has several credentials', () => {
    const content = [fakeKey('ghp_', 36), fakeKey('AKIA', 16)].join('\n');
    const matches = scanForCredentials(content);

    expect(matches).toContain('GitHub PAT (classic)');
    expect(matches).toContain('AWS Access Key');
  });
});

// ---------------------------------------------------------------------------
// isAllowedPath
// ---------------------------------------------------------------------------

describe('isAllowedPath', () => {
  it('allows .clancy/.env', () => {
    expect(isAllowedPath('/project/.clancy/.env')).toBe(true);
  });

  it('allows .env.example', () => {
    expect(isAllowedPath('/project/.env.example')).toBe(true);
  });

  it('allows .env.local', () => {
    expect(isAllowedPath('.env.local')).toBe(true);
  });

  it('allows .env.development', () => {
    expect(isAllowedPath('/app/.env.development')).toBe(true);
  });

  it('allows .env.test', () => {
    expect(isAllowedPath('.env.test')).toBe(true);
  });

  it('blocks .env (bare)', () => {
    expect(isAllowedPath('/project/.env')).toBe(false);
  });

  it('blocks config.ts', () => {
    expect(isAllowedPath('src/config.ts')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractContent
// ---------------------------------------------------------------------------

describe('extractContent', () => {
  it('extracts content from a Write tool input', () => {
    const input = { content: 'some data' };
    expect(extractContent('Write', input)).toBe('some data');
  });

  it('extracts new_string from an Edit tool input', () => {
    const input = { new_string: 'updated content' };
    expect(extractContent('Edit', input)).toBe('updated content');
  });

  it('joins edits from a MultiEdit tool input', () => {
    const input = {
      edits: [{ new_string: 'first' }, { new_string: 'second' }],
    };
    expect(extractContent('MultiEdit', input)).toBe('first\nsecond');
  });

  it('returns null for unsupported tool names', () => {
    const input = { command: 'ls' };
    expect(extractContent('Bash', input)).toBeNull();
  });

  it('returns null when Write input has no content field', () => {
    const input = {};
    expect(extractContent('Write', input)).toBeNull();
  });

  it('returns null when MultiEdit edits is not an array', () => {
    const input = { edits: 'not an array' };
    expect(extractContent('MultiEdit', input)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe('scanForCredentials — property-based', () => {
  const safeChars = 'abcdefghijklmnopqrstuvwxyz '.split('');
  const alnumChars = 'ABCDEFabcdef0123456789'.split('');

  it('never flags arbitrary lowercase alphabetic strings', () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.constantFrom(...safeChars), { maxLength: 100 })
          .map((a) => a.join('')),
        (content) => {
          expect(scanForCredentials(content)).toStrictEqual([]);
        },
      ),
    );
  });

  it('always detects a GitHub PAT (classic) prefix with 36 alnum chars', () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.constantFrom(...alnumChars), {
            minLength: 36,
            maxLength: 36,
          })
          .map((a) => a.join('')),
        (suffix) => {
          const content = `ghp_${suffix}`;
          expect(scanForCredentials(content)).toContain('GitHub PAT (classic)');
        },
      ),
    );
  });
});
