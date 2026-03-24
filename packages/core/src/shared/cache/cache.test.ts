import { describe, expect, it } from 'vitest';

import { Cached, CachedMap } from './cache.js';

describe('Cached', () => {
  it('returns undefined before any value is stored', () => {
    const cache = new Cached<string>();
    expect(cache.get()).toBeUndefined();
  });

  it('returns the stored value after store()', () => {
    const cache = new Cached<string>();
    cache.store('hello');
    expect(cache.get()).toBe('hello');
  });

  it('overwrites a previously stored value', () => {
    const cache = new Cached<number>();
    cache.store(1);
    cache.store(2);
    expect(cache.get()).toBe(2);
  });
});

describe('CachedMap', () => {
  it('returns undefined for an unknown key', () => {
    const map = new CachedMap<string, string>();
    expect(map.get('missing')).toBeUndefined();
  });

  it('returns the stored value for a known key', () => {
    const map = new CachedMap<string, string>();
    map.store('label-a', 'uuid-1');
    expect(map.get('label-a')).toBe('uuid-1');
  });

  it('reports whether a key exists via has()', () => {
    const map = new CachedMap<string, number>();
    expect(map.has('x')).toBe(false);
    map.store('x', 42);
    expect(map.has('x')).toBe(true);
  });

  it('overwrites a previously stored key', () => {
    const map = new CachedMap<string, string>();
    map.store('key', 'old');
    map.store('key', 'new');
    expect(map.get('key')).toBe('new');
  });

  it('stores multiple independent keys', () => {
    const map = new CachedMap<string, number>();
    map.store('a', 1);
    map.store('b', 2);
    expect(map.get('a')).toBe(1);
    expect(map.get('b')).toBe(2);
  });
});
