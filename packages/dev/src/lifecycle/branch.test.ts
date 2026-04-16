import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { targetBranch, ticketBranch } from './branch.js';

// ─── ticketBranch ──────────────────────────────────────────────

describe('ticketBranch', () => {
  it('returns feature/{key-lowercase} for Jira', () => {
    expect(ticketBranch('jira', 'PROJ-123')).toBe('feature/proj-123');
  });

  it('returns feature/issue-{number} for GitHub', () => {
    expect(ticketBranch('github', '#42')).toBe('feature/issue-42');
  });

  it('returns feature/{key-lowercase} for Linear', () => {
    expect(ticketBranch('linear', 'ENG-123')).toBe('feature/eng-123');
  });

  it('returns feature/{key-lowercase} for Shortcut', () => {
    expect(ticketBranch('shortcut', 'SC-456')).toBe('feature/sc-456');
  });

  it('returns feature/{key-lowercase} for Notion', () => {
    expect(ticketBranch('notion', 'TASK-789')).toBe('feature/task-789');
  });

  it('returns feature/{key-lowercase} for Azure DevOps', () => {
    expect(ticketBranch('azdo', 'AB#100')).toBe('feature/ab#100');
  });

  it('always starts with feature/ for non-GitHub providers', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('jira', 'linear', 'shortcut', 'notion', 'azdo'),
        fc.stringMatching(/^[A-Z]{2,5}-\d{1,4}$/),
        (provider, key) => {
          return ticketBranch(provider, key).startsWith('feature/');
        },
      ),
    );
  });

  it('always starts with feature/issue- for GitHub', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 99_999 }).map((n) => `#${n}`),
        (key) => {
          return ticketBranch('github', key).startsWith('feature/issue-');
        },
      ),
    );
  });
});

// ─── targetBranch ──────────────────────────────────────────────

describe('targetBranch', () => {
  it('returns baseBranch when no parent', () => {
    expect(targetBranch('jira', 'main')).toBe('main');
    expect(targetBranch('github', 'develop')).toBe('develop');
    expect(targetBranch('linear', 'main')).toBe('main');
  });

  it('returns epic/{key} for Jira with epic', () => {
    expect(targetBranch('jira', 'main', 'PROJ-100')).toBe('epic/proj-100');
  });

  it('returns epic/{number} for GitHub issue ref (#N)', () => {
    expect(targetBranch('github', 'main', '#44')).toBe('epic/44');
  });

  it('returns epic/{number} for single-digit GitHub issue ref', () => {
    expect(targetBranch('github', 'main', '#7')).toBe('epic/7');
  });

  it('returns milestone/{slug} for GitHub with milestone title', () => {
    expect(targetBranch('github', 'main', 'Sprint 3')).toBe(
      'milestone/sprint-3',
    );
  });

  it('strips non-alphanumeric chars from GitHub milestone slug', () => {
    expect(targetBranch('github', 'main', 'v1.0 Release!')).toBe(
      'milestone/v10-release',
    );
  });

  it('returns epic/{id} for Linear with parent', () => {
    expect(targetBranch('linear', 'main', 'ENG-50')).toBe('epic/eng-50');
  });

  it('returns baseBranch when parent is undefined', () => {
    expect(targetBranch('jira', 'develop', undefined)).toBe('develop');
  });

  it('returns baseBranch when parent is empty string', () => {
    expect(targetBranch('jira', 'main', '')).toBe('main');
  });

  it('produces milestone/ with empty slug for all-special-char title', () => {
    expect(targetBranch('github', 'main', '!!!')).toBe('milestone/');
  });

  it('returns epic/{key} for Shortcut with parent', () => {
    expect(targetBranch('shortcut', 'main', 'SC-10')).toBe('epic/sc-10');
  });

  it('returns epic/{key} for Notion with parent', () => {
    expect(targetBranch('notion', 'main', 'EPIC-5')).toBe('epic/epic-5');
  });

  it('returns epic/{key} for Azure DevOps with parent', () => {
    expect(targetBranch('azdo', 'main', 'AB#200')).toBe('epic/ab#200');
  });

  it('always returns baseBranch when parent is absent', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'jira',
          'github',
          'linear',
          'shortcut',
          'notion',
          'azdo',
        ),
        fc.stringMatching(/^[a-z]{2,10}$/),
        (provider, base) => {
          return targetBranch(provider, base) === base;
        },
      ),
    );
  });

  it('never returns an empty string when parent is provided', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('jira', 'linear', 'shortcut', 'notion', 'azdo'),
        fc.stringMatching(/^[a-z]{2,10}$/),
        fc.stringMatching(/^[A-Z]{2,5}-\d{1,4}$/),
        (provider, base, parent) => {
          return targetBranch(provider, base, parent).length > 0;
        },
      ),
    );
  });
});
