import {
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { copyDir, fileHash, inlineWorkflows } from './file-ops.js';

describe('fileHash', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = join(tmpdir(), `clancy-test-${Date.now()}-${crypto.randomUUID()}`);
    mkdirSync(tmp, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns a consistent SHA-256 hex string', () => {
    const file = join(tmp, 'test.txt');
    writeFileSync(file, 'hello world');
    const hash = fileHash(file);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(fileHash(file)).toBe(hash);
  });

  it('returns different hashes for different content', () => {
    const a = join(tmp, 'a.txt');
    const b = join(tmp, 'b.txt');
    writeFileSync(a, 'content A');
    writeFileSync(b, 'content B');

    expect(fileHash(a)).not.toBe(fileHash(b));
  });

  it('throws when the file does not exist', () => {
    expect(() => fileHash(join(tmp, 'missing.txt'))).toThrow();
  });
});

describe('copyDir', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = join(tmpdir(), `clancy-test-${Date.now()}-${crypto.randomUUID()}`);
    mkdirSync(tmp, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('copies files recursively', () => {
    const src = join(tmp, 'src');
    const dest = join(tmp, 'dest');
    mkdirSync(join(src, 'sub'), { recursive: true });
    writeFileSync(join(src, 'a.txt'), 'aaa');
    writeFileSync(join(src, 'sub', 'b.txt'), 'bbb');

    copyDir(src, dest);

    expect(fileHash(join(dest, 'a.txt'))).toBe(fileHash(join(src, 'a.txt')));
    expect(fileHash(join(dest, 'sub', 'b.txt'))).toBe(
      fileHash(join(src, 'sub', 'b.txt')),
    );
  });

  it('throws when source directory does not exist', () => {
    const src = join(tmp, 'missing');
    const dest = join(tmp, 'dest');

    expect(() => copyDir(src, dest)).toThrow();
  });

  it('throws if destination is a symlink', () => {
    const src = join(tmp, 'src');
    const dest = join(tmp, 'dest-link');
    const target = join(tmp, 'target');
    mkdirSync(src, { recursive: true });
    mkdirSync(target, { recursive: true });
    symlinkSync(target, dest);

    expect(() => copyDir(src, dest)).toThrow('symlink');
  });

  it('throws if an individual file in destination is a symlink', () => {
    const src = join(tmp, 'src');
    const dest = join(tmp, 'dest');
    const target = join(tmp, 'target.txt');
    mkdirSync(src, { recursive: true });
    mkdirSync(dest, { recursive: true });
    writeFileSync(join(src, 'file.txt'), 'content');
    writeFileSync(target, 'target content');
    symlinkSync(target, join(dest, 'file.txt'));

    expect(() => copyDir(src, dest)).toThrow('symlink');
  });

  it('throws if destination is a dangling symlink', () => {
    const src = join(tmp, 'src');
    const dest = join(tmp, 'dangling-link');
    mkdirSync(src, { recursive: true });
    symlinkSync(join(tmp, 'nonexistent'), dest);

    expect(() => copyDir(src, dest)).toThrow('symlink');
  });

  it('merges multiple source directories into a single destination', () => {
    const roleA = join(tmp, 'roles', 'implementer', 'commands');
    const roleB = join(tmp, 'roles', 'reviewer', 'commands');
    const dest = join(tmp, 'dest');
    mkdirSync(roleA, { recursive: true });
    mkdirSync(roleB, { recursive: true });
    writeFileSync(join(roleA, 'once.md'), 'once content');
    writeFileSync(join(roleB, 'review.md'), 'review content');

    copyDir(roleA, dest);
    copyDir(roleB, dest);

    expect(fileHash(join(dest, 'once.md'))).toBe(
      fileHash(join(roleA, 'once.md')),
    );
    expect(fileHash(join(dest, 'review.md'))).toBe(
      fileHash(join(roleB, 'review.md')),
    );
  });
});

describe('inlineWorkflows', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = join(tmpdir(), `clancy-test-${Date.now()}-${crypto.randomUUID()}`);
    mkdirSync(tmp, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('replaces @-file reference with workflow content', () => {
    const cmds = join(tmp, 'commands');
    const workflows = join(tmp, 'workflows');
    mkdirSync(cmds, { recursive: true });
    mkdirSync(workflows, { recursive: true });

    writeFileSync(
      join(cmds, 'build.md'),
      'Run build:\n@.claude/clancy/workflows/build-steps.md\nDone.',
    );
    writeFileSync(join(workflows, 'build-steps.md'), 'step 1\nstep 2');

    inlineWorkflows(cmds, workflows);

    const result = readFileSync(join(cmds, 'build.md'), 'utf8');
    expect(result).toBe('Run build:\nstep 1\nstep 2\nDone.');
  });

  it('replaces multiple @-file references in a single file', () => {
    const cmds = join(tmp, 'commands');
    const workflows = join(tmp, 'workflows');
    mkdirSync(cmds, { recursive: true });
    mkdirSync(workflows, { recursive: true });

    writeFileSync(
      join(cmds, 'full.md'),
      [
        'Setup:',
        '@.claude/clancy/workflows/setup.md',
        'Middle section.',
        '@.claude/clancy/workflows/teardown.md',
        'Done.',
      ].join('\n'),
    );
    writeFileSync(join(workflows, 'setup.md'), 'setup steps');
    writeFileSync(join(workflows, 'teardown.md'), 'teardown steps');

    inlineWorkflows(cmds, workflows);

    const result = readFileSync(join(cmds, 'full.md'), 'utf8');
    expect(result).toBe(
      [
        'Setup:',
        'setup steps',
        'Middle section.',
        'teardown steps',
        'Done.',
      ].join('\n'),
    );
  });

  it('leaves files without workflow references unchanged', () => {
    const cmds = join(tmp, 'commands');
    const workflows = join(tmp, 'workflows');
    mkdirSync(cmds, { recursive: true });
    mkdirSync(workflows, { recursive: true });

    writeFileSync(join(cmds, 'simple.md'), 'No workflow here.');

    inlineWorkflows(cmds, workflows);

    const result = readFileSync(join(cmds, 'simple.md'), 'utf8');
    expect(result).toBe('No workflow here.');
  });

  it('skips references to missing workflow files', () => {
    const cmds = join(tmp, 'commands');
    const workflows = join(tmp, 'workflows');
    mkdirSync(cmds, { recursive: true });
    mkdirSync(workflows, { recursive: true });

    const original = 'Before\n@.claude/clancy/workflows/missing.md\nAfter';
    writeFileSync(join(cmds, 'cmd.md'), original);

    inlineWorkflows(cmds, workflows);

    const result = readFileSync(join(cmds, 'cmd.md'), 'utf8');
    expect(result).toBe(original);
  });

  it('ignores non-markdown files', () => {
    const cmds = join(tmp, 'commands');
    const workflows = join(tmp, 'workflows');
    mkdirSync(cmds, { recursive: true });
    mkdirSync(workflows, { recursive: true });

    const original = '@.claude/clancy/workflows/build.md';
    writeFileSync(join(cmds, 'notes.txt'), original);
    writeFileSync(join(workflows, 'build.md'), 'inlined');

    inlineWorkflows(cmds, workflows);

    const result = readFileSync(join(cmds, 'notes.txt'), 'utf8');
    expect(result).toBe(original);
  });

  it('ignores references with path traversal attempts', () => {
    const cmds = join(tmp, 'commands');
    const workflows = join(tmp, 'workflows');
    mkdirSync(cmds, { recursive: true });
    mkdirSync(workflows, { recursive: true });

    const original = '@.claude/clancy/workflows/../../../secrets.md';
    writeFileSync(join(cmds, 'cmd.md'), original);

    inlineWorkflows(cmds, workflows);

    const result = readFileSync(join(cmds, 'cmd.md'), 'utf8');
    expect(result).toBe(original);
  });

  it('throws if a command file is a symlink', () => {
    const cmds = join(tmp, 'commands');
    const workflows = join(tmp, 'workflows');
    const target = join(tmp, 'target.md');
    mkdirSync(cmds, { recursive: true });
    mkdirSync(workflows, { recursive: true });

    writeFileSync(target, '@.claude/clancy/workflows/build.md');
    symlinkSync(target, join(cmds, 'cmd.md'));
    writeFileSync(join(workflows, 'build.md'), 'inlined');

    expect(() => inlineWorkflows(cmds, workflows)).toThrow('symlink');
  });
});
