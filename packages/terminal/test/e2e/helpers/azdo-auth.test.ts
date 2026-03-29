import { describe, expect, it } from 'vitest';

import {
  azdoBaseUrl,
  azdoHeaders,
  azdoPatchHeaders,
  buildAzdoAuth,
} from './azdo-auth.js';

describe('buildAzdoAuth', () => {
  it('base64-encodes :<PAT> format', () => {
    const auth = buildAzdoAuth('my-pat');
    const decoded = Buffer.from(auth, 'base64').toString('utf8');

    expect(decoded).toBe(':my-pat');
  });
});

describe('azdoHeaders', () => {
  it('returns JSON headers with Basic auth', () => {
    const headers = azdoHeaders('encoded-auth');

    expect(headers).toEqual({
      Authorization: 'Basic encoded-auth',
      'Content-Type': 'application/json',
    });
  });
});

describe('azdoPatchHeaders', () => {
  it('returns JSON Patch headers with Basic auth', () => {
    const headers = azdoPatchHeaders('encoded-auth');

    expect(headers).toEqual({
      Authorization: 'Basic encoded-auth',
      'Content-Type': 'application/json-patch+json',
    });
  });
});

describe('azdoBaseUrl', () => {
  it('builds the correct API URL', () => {
    const url = azdoBaseUrl('my-org', 'my-project');

    expect(url).toBe('https://dev.azure.com/my-org/my-project/_apis');
  });

  it('encodes special characters', () => {
    const url = azdoBaseUrl('org with spaces', 'project/slash');

    expect(url).toBe(
      'https://dev.azure.com/org%20with%20spaces/project%2Fslash/_apis',
    );
  });
});
