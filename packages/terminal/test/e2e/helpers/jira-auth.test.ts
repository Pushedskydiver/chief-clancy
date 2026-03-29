import { describe, expect, it } from 'vitest';

import { buildJiraAuth } from './jira-auth.js';

describe('buildJiraAuth', () => {
  it('base64-encodes user:apiToken format', () => {
    const auth = buildJiraAuth('user@example.com', 'api-token');
    const decoded = Buffer.from(auth, 'base64').toString('utf8');

    expect(decoded).toBe('user@example.com:api-token');
  });
});
