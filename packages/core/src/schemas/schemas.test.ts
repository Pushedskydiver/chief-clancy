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
});
