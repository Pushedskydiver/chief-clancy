import { describe, expect, it } from 'vitest';

import {
  buildTitle,
  createTestTicket,
  generateRunId,
} from './ticket-factory.js';

describe('generateRunId', () => {
  it('produces a non-empty string', () => {
    const id = generateRunId();

    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
  });

  it('includes a timestamp prefix', () => {
    const before = Date.now();
    const id = generateRunId();
    const after = Date.now();

    const timestamp = Number(id.split('-')[0]);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it('produces unique values on successive calls', () => {
    const ids = Array.from({ length: 10 }, () => generateRunId());
    const unique = new Set(ids);

    expect(unique.size).toBe(10);
  });
});

describe('buildTitle', () => {
  it('formats a standard title with [QA] prefix', () => {
    const title = buildTitle('github', 'run-123');

    expect(title).toBe('[QA] E2E test — github — run-123');
  });

  it('appends a title suffix when provided', () => {
    const title = buildTitle('jira', 'run-456', 'custom suffix');

    expect(title).toBe('[QA] E2E test — jira — run-456 — custom suffix');
  });

  it('omits suffix separator when no suffix', () => {
    const title = buildTitle('linear', 'run-789');

    expect(title).not.toContain('undefined');
    expect(title).toBe('[QA] E2E test — linear — run-789');
  });
});

describe('createTestTicket', () => {
  it('is a callable function accepting board, runId, options', () => {
    // Real API calls tested in E2E tests (12.6+) — verify type/export here
    expect(typeof createTestTicket).toBe('function');
    // .length is 2 because `options` has a default value
    expect(createTestTicket.length).toBe(2);
  });
});
