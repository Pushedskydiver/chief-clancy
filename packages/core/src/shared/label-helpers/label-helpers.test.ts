import { describe, expect, it, vi } from 'vitest';

import { modifyLabelList, safeLabel } from './label-helpers.js';

describe('safeLabel', () => {
  it('calls the operation and returns normally on success', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    await safeLabel(fn, 'addLabel');
    expect(fn).toHaveBeenCalled();
  });

  it('catches errors and warns without throwing', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('network'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await safeLabel(fn, 'addLabel');

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('addLabel'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('network'));
    warn.mockRestore();
  });

  it('handles non-Error throws', async () => {
    const fn = vi.fn().mockRejectedValue('string error');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await safeLabel(fn, 'removeLabel');

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('string error'));
    warn.mockRestore();
  });
});

describe('modifyLabelList', () => {
  it('adds a label when not present', async () => {
    const write = vi.fn().mockResolvedValue(undefined);

    await modifyLabelList({
      fetchCurrent: async () => ['a', 'b'],
      writeUpdated: write,
      target: 'c',
      mode: 'add',
    });

    expect(write).toHaveBeenCalledWith(['a', 'b', 'c']);
  });

  it('skips add when label already present', async () => {
    const write = vi.fn();

    await modifyLabelList({
      fetchCurrent: async () => ['a', 'b'],
      writeUpdated: write,
      target: 'b',
      mode: 'add',
    });

    expect(write).not.toHaveBeenCalled();
  });

  it('removes a label when present', async () => {
    const write = vi.fn().mockResolvedValue(undefined);

    await modifyLabelList({
      fetchCurrent: async () => ['a', 'b', 'c'],
      writeUpdated: write,
      target: 'b',
      mode: 'remove',
    });

    expect(write).toHaveBeenCalledWith(['a', 'c']);
  });

  it('skips remove when label not present', async () => {
    const write = vi.fn();

    await modifyLabelList({
      fetchCurrent: async () => ['a', 'b'],
      writeUpdated: write,
      target: 'z',
      mode: 'remove',
    });

    expect(write).not.toHaveBeenCalled();
  });

  it('returns early when fetchCurrent returns undefined', async () => {
    const write = vi.fn();

    await modifyLabelList({
      fetchCurrent: async () => undefined,
      writeUpdated: write,
      target: 'x',
      mode: 'add',
    });

    expect(write).not.toHaveBeenCalled();
  });

  it('works with number arrays', async () => {
    const write = vi.fn().mockResolvedValue(undefined);

    await modifyLabelList({
      fetchCurrent: async () => [1, 2, 3],
      writeUpdated: write,
      target: 4,
      mode: 'add',
    });

    expect(write).toHaveBeenCalledWith([1, 2, 3, 4]);
  });

  it('removes from number arrays', async () => {
    const write = vi.fn().mockResolvedValue(undefined);

    await modifyLabelList({
      fetchCurrent: async () => [1, 2, 3],
      writeUpdated: write,
      target: 2,
      mode: 'remove',
    });

    expect(write).toHaveBeenCalledWith([1, 3]);
  });

  it('adds to empty array', async () => {
    const write = vi.fn().mockResolvedValue(undefined);

    await modifyLabelList({
      fetchCurrent: async () => [],
      writeUpdated: write,
      target: 'first',
      mode: 'add',
    });

    expect(write).toHaveBeenCalledWith(['first']);
  });

  it('skips remove from empty array', async () => {
    const write = vi.fn();

    await modifyLabelList({
      fetchCurrent: async () => [],
      writeUpdated: write,
      target: 'x',
      mode: 'remove',
    });

    expect(write).not.toHaveBeenCalled();
  });

  it('propagates writeUpdated errors to caller', async () => {
    const write = vi.fn().mockRejectedValue(new Error('write failed'));

    await expect(
      modifyLabelList({
        fetchCurrent: async () => ['a'],
        writeUpdated: write,
        target: 'b',
        mode: 'add',
      }),
    ).rejects.toThrow('write failed');
  });
});
