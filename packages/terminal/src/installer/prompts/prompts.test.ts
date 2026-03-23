import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createPrompts } from './prompts.js';

/** Minimal mock that satisfies the ReadlineInterface shape. */
function mockReadline() {
  return {
    question: vi.fn<(q: string, cb: (answer: string) => void) => void>(),
    close: vi.fn(),
  };
}

/** Capture all console.log output as a single string. */
function captureOutput(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
}

describe('createPrompts', () => {
  it('returns an object with ask, choose, and close', () => {
    const rl = mockReadline();
    const prompts = createPrompts(rl);

    expect(prompts).toHaveProperty('ask');
    expect(prompts).toHaveProperty('choose');
    expect(prompts).toHaveProperty('close');
  });
});

describe('ask', () => {
  it('resolves with the user answer', async () => {
    const rl = mockReadline();
    rl.question.mockImplementation((_q, cb) => cb('hello'));
    const { ask } = createPrompts(rl);

    const result = await ask('Name: ');

    expect(result).toBe('hello');
    expect(rl.question).toHaveBeenCalledWith('Name: ', expect.any(Function));
  });

  it('resolves with empty string when user provides no input', async () => {
    const rl = mockReadline();
    rl.question.mockImplementation((_q, cb) => cb(''));
    const { ask } = createPrompts(rl);

    const result = await ask('Prompt: ');

    expect(result).toBe('');
  });
});

describe('choose', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('displays the question and numbered options', async () => {
    const rl = mockReadline();
    rl.question.mockImplementation((_q, cb) => cb('2'));
    const { choose } = createPrompts(rl);

    await choose('Pick a colour:', ['Red', 'Blue'], 1);

    const output = captureOutput(logSpy);
    expect(output).toContain('Pick a colour:');
    expect(output).toContain('1) Red');
    expect(output).toContain('2) Blue');
  });

  it('returns the user selection when provided', async () => {
    const rl = mockReadline();
    rl.question.mockImplementation((_q, cb) => cb('2'));
    const { choose } = createPrompts(rl);

    const result = await choose('Pick:', ['A', 'B'], 1);

    expect(result).toBe('2');
  });

  it('returns the default choice when user presses enter', async () => {
    const rl = mockReadline();
    rl.question.mockImplementation((_q, cb) => cb(''));
    const { choose } = createPrompts(rl);

    const result = await choose('Pick:', ['A', 'B'], 1);

    expect(result).toBe('1');
  });

  it('returns the default choice when user enters only whitespace', async () => {
    const rl = mockReadline();
    rl.question.mockImplementation((_q, cb) => cb('   '));
    const { choose } = createPrompts(rl);

    const result = await choose('Pick:', ['A', 'B'], 2);

    expect(result).toBe('2');
  });

  it('uses 1 as default when no defaultChoice is specified', async () => {
    const rl = mockReadline();
    rl.question.mockImplementation((_q, cb) => cb(''));
    const { choose } = createPrompts(rl);

    const result = await choose('Pick:', ['X', 'Y']);

    expect(result).toBe('1');
  });
});

describe('close', () => {
  it('closes the underlying readline interface', () => {
    const rl = mockReadline();
    const { close } = createPrompts(rl);

    close();

    expect(rl.close).toHaveBeenCalled();
  });
});
