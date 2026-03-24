import { describe, expect, it } from 'vitest';

import {
  apiBase,
  azdoHeaders,
  azdoPatchHeaders,
  buildAzdoAuth,
  buildTagsString,
  extractIdFromRelationUrl,
  isSafeWiqlValue,
  parseTags,
  parseWorkItemId,
} from './helpers.js';

describe('azdo helpers', () => {
  // ─── buildAzdoAuth ────────────────────────────────────────────────────────

  describe('buildAzdoAuth', () => {
    it('returns Basic auth with base64-encoded :pat', () => {
      const result = buildAzdoAuth('my-pat');
      expect(result).toBe(`Basic ${btoa(':my-pat')}`);
    });

    it('includes colon before PAT', () => {
      const decoded = atob(buildAzdoAuth('test').replace('Basic ', ''));
      expect(decoded).toBe(':test');
    });
  });

  // ─── azdoHeaders ─────────────────────────────────────────────────────────

  describe('azdoHeaders', () => {
    it('returns Authorization and Content-Type', () => {
      const headers = azdoHeaders('pat');
      expect(headers.Authorization).toContain('Basic ');
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  // ─── azdoPatchHeaders ────────────────────────────────────────────────────

  describe('azdoPatchHeaders', () => {
    it('returns json-patch+json content type', () => {
      const headers = azdoPatchHeaders('pat');
      expect(headers['Content-Type']).toBe('application/json-patch+json');
    });
  });

  // ─── isSafeWiqlValue ─────────────────────────────────────────────────────

  describe('isSafeWiqlValue', () => {
    it('accepts normal project names', () => {
      expect(isSafeWiqlValue('MyProject')).toBe(true);
      expect(isSafeWiqlValue('my-project')).toBe(true);
      expect(isSafeWiqlValue('Project 123')).toBe(true);
    });

    it('blocks single quotes', () => {
      expect(isSafeWiqlValue("test'injection")).toBe(false);
    });

    it('blocks backslashes', () => {
      expect(isSafeWiqlValue('test\\escape')).toBe(false);
    });

    it('blocks SQL comments', () => {
      expect(isSafeWiqlValue('test--comment')).toBe(false);
    });

    it('blocks semicolons', () => {
      expect(isSafeWiqlValue('test;DROP')).toBe(false);
    });

    it('blocks block comments', () => {
      expect(isSafeWiqlValue('test/*comment*/')).toBe(false);
    });

    it('blocks non-printable characters', () => {
      expect(isSafeWiqlValue('test\x00value')).toBe(false);
      expect(isSafeWiqlValue('test\x01value')).toBe(false);
    });

    it('allows tabs', () => {
      expect(isSafeWiqlValue('test\tvalue')).toBe(true);
    });

    it('blocks newlines', () => {
      expect(isSafeWiqlValue('test\nvalue')).toBe(false);
      expect(isSafeWiqlValue('test\rvalue')).toBe(false);
    });
  });

  // ─── apiBase ──────────────────────────────────────────────────────────────

  describe('apiBase', () => {
    it('builds URL with encoded org and project', () => {
      expect(apiBase('myorg', 'MyProject')).toBe(
        'https://dev.azure.com/myorg/MyProject/_apis',
      );
    });

    it('encodes special characters', () => {
      expect(apiBase('my org', 'my project')).toBe(
        'https://dev.azure.com/my%20org/my%20project/_apis',
      );
    });
  });

  // ─── parseTags / buildTagsString ──────────────────────────────────────────

  describe('parseTags', () => {
    it('parses semicolon-separated tags', () => {
      expect(parseTags('tag1; tag2; tag3')).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('handles null/undefined', () => {
      expect(parseTags(null)).toEqual([]);
      expect(parseTags(undefined)).toEqual([]);
    });

    it('handles empty string', () => {
      expect(parseTags('')).toEqual([]);
    });

    it('trims whitespace', () => {
      expect(parseTags('  tag1  ;  tag2  ')).toEqual(['tag1', 'tag2']);
    });

    it('filters empty entries', () => {
      expect(parseTags('tag1;;tag2')).toEqual(['tag1', 'tag2']);
    });
  });

  describe('buildTagsString', () => {
    it('joins tags with semicolons', () => {
      expect(buildTagsString(['tag1', 'tag2', 'tag3'])).toBe(
        'tag1; tag2; tag3',
      );
    });

    it('handles single tag', () => {
      expect(buildTagsString(['tag1'])).toBe('tag1');
    });

    it('handles empty array', () => {
      expect(buildTagsString([])).toBe('');
    });
  });

  // ─── extractIdFromRelationUrl ─────────────────────────────────────────────

  describe('extractIdFromRelationUrl', () => {
    it('extracts ID from standard relation URL', () => {
      expect(
        extractIdFromRelationUrl(
          'https://dev.azure.com/myorg/_apis/wit/workItems/42',
        ),
      ).toBe(42);
    });

    it('returns undefined for invalid URL', () => {
      expect(extractIdFromRelationUrl('https://example.com/no-id')).toBe(
        undefined,
      );
    });

    it('handles case-insensitive match', () => {
      expect(
        extractIdFromRelationUrl(
          'https://dev.azure.com/myorg/_apis/wit/WorkItems/99',
        ),
      ).toBe(99);
    });
  });

  // ─── parseWorkItemId ──────────────────────────────────────────────────────

  describe('parseWorkItemId', () => {
    it('parses azdo-123 format', () => {
      expect(parseWorkItemId('azdo-42')).toBe(42);
    });

    it('returns undefined for invalid format', () => {
      expect(parseWorkItemId('invalid')).toBe(undefined);
    });

    it('returns undefined for NaN', () => {
      expect(parseWorkItemId('azdo-abc')).toBe(undefined);
    });
  });
});
