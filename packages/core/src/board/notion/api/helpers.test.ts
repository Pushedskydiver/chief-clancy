import type { NotionPage } from '~/c/schemas/notion.js';

import { describe, expect, it } from 'vitest';

import {
  buildNotionKey,
  findPropertyByName,
  getArrayProperty,
  getDescriptionText,
  getPageStatus,
  getPageTitle,
  getStringProperty,
  isCompleteStatus,
  isPageIncomplete,
  notionHeaders,
  parseNotionShortId,
} from './helpers.js';

const PAGE_ID = 'ab12cd34-5678-9abc-def0-123456789abc';

function makePage(id: string, extra: Record<string, unknown> = {}): NotionPage {
  return {
    id,
    properties: {
      Name: { type: 'title', title: [{ plain_text: 'Test' }] },
      Status: { type: 'status', status: { name: 'To-do' } },
      ...extra,
    },
  };
}

describe('notion helpers', () => {
  // ─── notionHeaders ──────────────────────────────────────────────────────

  describe('notionHeaders', () => {
    it('returns Authorization, Notion-Version, and Content-Type', () => {
      const headers = notionHeaders('ntn_test');
      expect(headers.Authorization).toBe('Bearer ntn_test');
      expect(headers['Notion-Version']).toBe('2022-06-28');
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  // ─── getStringProperty ──────────────────────────────────────────────────

  describe('getStringProperty', () => {
    it('extracts status property', () => {
      const page = makePage(PAGE_ID);
      expect(getStringProperty(page, 'Status', 'status')).toBe('To-do');
    });

    it('extracts title property', () => {
      const page = makePage(PAGE_ID);
      expect(getStringProperty(page, 'Name', 'title')).toBe('Test');
    });

    it('extracts select property', () => {
      const page = makePage(PAGE_ID, {
        Priority: { type: 'select', select: { name: 'High' } },
      });
      expect(getStringProperty(page, 'Priority', 'select')).toBe('High');
    });

    it('extracts rich_text property', () => {
      const page = makePage(PAGE_ID, {
        Description: {
          type: 'rich_text',
          rich_text: [{ plain_text: 'Hello ' }, { plain_text: 'world' }],
        },
      });
      expect(getStringProperty(page, 'Description', 'rich_text')).toBe(
        'Hello world',
      );
    });

    it('returns undefined for null status', () => {
      const page = makePage(PAGE_ID, {
        Status: { type: 'status', status: null },
      });
      expect(getStringProperty(page, 'Status', 'status')).toBeUndefined();
    });

    it('returns undefined for missing property', () => {
      const page = makePage(PAGE_ID);
      expect(getStringProperty(page, 'Missing', 'status')).toBeUndefined();
    });

    it('returns undefined for type mismatch', () => {
      const page = makePage(PAGE_ID);
      expect(getStringProperty(page, 'Status', 'title')).toBeUndefined();
    });
  });

  // ─── getArrayProperty ──────────────────────────────────────────────────

  describe('getArrayProperty', () => {
    it('extracts multi_select names', () => {
      const page = makePage(PAGE_ID, {
        Labels: {
          type: 'multi_select',
          multi_select: [{ name: 'bug' }, { name: 'urgent' }],
        },
      });
      expect(getArrayProperty(page, 'Labels', 'multi_select')).toEqual([
        'bug',
        'urgent',
      ]);
    });

    it('extracts relation IDs', () => {
      const page = makePage(PAGE_ID, {
        Epic: { type: 'relation', relation: [{ id: 'page-1' }] },
      });
      expect(getArrayProperty(page, 'Epic', 'relation')).toEqual(['page-1']);
    });

    it('extracts people IDs', () => {
      const page = makePage(PAGE_ID, {
        Assignee: { type: 'people', people: [{ id: 'user-1' }] },
      });
      expect(getArrayProperty(page, 'Assignee', 'people')).toEqual(['user-1']);
    });

    it('returns undefined for missing property', () => {
      const page = makePage(PAGE_ID);
      expect(getArrayProperty(page, 'Missing', 'multi_select')).toBeUndefined();
    });
  });

  // ─── Key helpers ────────────────────────────────────────────────────────

  describe('buildNotionKey', () => {
    it('builds short key from UUID', () => {
      expect(buildNotionKey(PAGE_ID)).toBe('notion-ab12cd34');
    });
  });

  describe('parseNotionShortId', () => {
    it('extracts 8-char short ID', () => {
      expect(parseNotionShortId('notion-ab12cd34')).toBe('ab12cd34');
    });

    it('returns undefined for invalid key', () => {
      expect(parseNotionShortId('notion-')).toBeUndefined();
      expect(parseNotionShortId('bad')).toBeUndefined();
    });
  });

  // ─── Status helpers ─────────────────────────────────────────────────────

  describe('isCompleteStatus', () => {
    it('recognises done-like statuses', () => {
      expect(isCompleteStatus('Done')).toBe(true);
      expect(isCompleteStatus('complete')).toBe(true);
      expect(isCompleteStatus('Completed')).toBe(true);
      expect(isCompleteStatus('CLOSED')).toBe(true);
    });

    it('rejects non-done statuses', () => {
      expect(isCompleteStatus('To-do')).toBe(false);
      expect(isCompleteStatus('In Progress')).toBe(false);
    });
  });

  describe('getPageTitle', () => {
    it('returns title from first title-type property', () => {
      const page = makePage(PAGE_ID);
      expect(getPageTitle(page)).toBe('Test');
    });

    it('returns empty string when no title property', () => {
      const page = { id: PAGE_ID, properties: {} } as NotionPage;
      expect(getPageTitle(page)).toBe('');
    });
  });

  describe('getPageStatus', () => {
    it('returns status property value', () => {
      const page = makePage(PAGE_ID);
      expect(getPageStatus(page, 'Status')).toBe('To-do');
    });

    it('falls back to select type', () => {
      const page = makePage(PAGE_ID, {
        Status: { type: 'select', select: { name: 'Active' } },
      });
      expect(getPageStatus(page, 'Status')).toBe('Active');
    });
  });

  describe('isPageIncomplete', () => {
    it('returns true for non-done status', () => {
      const page = makePage(PAGE_ID);
      expect(isPageIncomplete(page, 'Status')).toBe(true);
    });

    it('returns false for done status', () => {
      const page = makePage(PAGE_ID, {
        Status: { type: 'status', status: { name: 'Done' } },
      });
      expect(isPageIncomplete(page, 'Status')).toBe(false);
    });
  });

  describe('getDescriptionText', () => {
    it('returns text from Description property', () => {
      const page = makePage(PAGE_ID, {
        Description: {
          type: 'rich_text',
          rich_text: [{ plain_text: 'content' }],
        },
      });
      expect(getDescriptionText(page)).toBe('content');
    });

    it('returns undefined when no description', () => {
      const page = makePage(PAGE_ID);
      expect(getDescriptionText(page)).toBeUndefined();
    });
  });

  describe('findPropertyByName', () => {
    it('finds exact match', () => {
      const page = makePage(PAGE_ID);
      expect(findPropertyByName(page, 'Status')?.type).toBe('status');
    });

    it('finds case-insensitive match', () => {
      const page = makePage(PAGE_ID);
      expect(findPropertyByName(page, 'status')?.type).toBe('status');
    });

    it('returns undefined when not found', () => {
      const page = makePage(PAGE_ID);
      expect(findPropertyByName(page, 'Missing')).toBeUndefined();
    });
  });
});
