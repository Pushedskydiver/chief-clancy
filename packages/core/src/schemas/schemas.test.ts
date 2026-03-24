import { describe, expect, it } from 'vitest';
import { z } from 'zod/mini';

describe('zod/mini smoke test', () => {
  it('parses a string schema', () => {
    const schema = z.string();
    const result = z.safeParse(schema, 'hello');
    expect(result.success).toBe(true);
  });

  it('rejects invalid input', () => {
    const schema = z.string();
    const result = z.safeParse(schema, 42);
    expect(result.success).toBe(false);
  });

  it('supports .check() with z.minLength()', () => {
    const schema = z.string().check(z.minLength(3));
    expect(z.safeParse(schema, 'ab').success).toBe(false);
    expect(z.safeParse(schema, 'abc').success).toBe(true);
  });

  it('supports .check() with z.regex()', () => {
    const schema = z.string().check(z.regex(/^[A-Z_]+$/));
    expect(z.safeParse(schema, 'VALID_KEY').success).toBe(true);
    expect(z.safeParse(schema, 'invalid').success).toBe(false);
  });
});
