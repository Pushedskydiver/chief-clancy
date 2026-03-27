import type { HookEvent } from '../shared/types.js';

import { describe, expect, it, vi } from 'vitest';

import {
  escapeAppleScript,
  escapePowerShell,
  extractMessage,
  sendNotification,
} from './send-notification.js';

// ---------------------------------------------------------------------------
// extractMessage
// ---------------------------------------------------------------------------

describe('extractMessage', () => {
  it('returns message field when present', () => {
    const event: HookEvent = { message: 'hello' };

    expect(extractMessage(event)).toBe('hello');
  });

  it('returns notification field when message is absent', () => {
    const event: HookEvent = { notification: 'notify me' };

    expect(extractMessage(event)).toBe('notify me');
  });

  it('returns text field when message and notification are absent', () => {
    const event = { text: 'text value' } as HookEvent;

    expect(extractMessage(event)).toBe('text value');
  });

  it('returns default message when no fields match', () => {
    const event: HookEvent = {};

    expect(extractMessage(event)).toBe('Clancy notification');
  });

  it('skips empty message field', () => {
    const event: HookEvent = { message: '', notification: 'fallback' };

    expect(extractMessage(event)).toBe('fallback');
  });

  it('skips empty notification field to text', () => {
    const event = { message: '', notification: '', text: 'last' } as HookEvent;

    expect(extractMessage(event)).toBe('last');
  });

  it('returns default when all fields are empty', () => {
    const event = { message: '', notification: '', text: '' } as HookEvent;

    expect(extractMessage(event)).toBe('Clancy notification');
  });

  it('returns hookSpecificOutput.message when other fields are absent', () => {
    const event = {
      hookSpecificOutput: { message: 'nested msg' },
    } as HookEvent;

    expect(extractMessage(event)).toBe('nested msg');
  });

  it('prefers message over hookSpecificOutput.message', () => {
    const event = {
      message: 'top level',
      hookSpecificOutput: { message: 'nested' },
    } as HookEvent;

    expect(extractMessage(event)).toBe('top level');
  });
});

// ---------------------------------------------------------------------------
// escapeAppleScript
// ---------------------------------------------------------------------------

describe('escapeAppleScript', () => {
  it('escapes double quotes', () => {
    expect(escapeAppleScript('say "hi"')).toBe('say \\"hi\\"');
  });

  it('escapes backslashes', () => {
    expect(escapeAppleScript('path\\to')).toBe('path\\\\to');
  });

  it('escapes backslash before double quote', () => {
    expect(escapeAppleScript('a\\"b')).toBe('a\\\\\\"b');
  });

  it('returns unchanged string without special chars', () => {
    expect(escapeAppleScript('hello')).toBe('hello');
  });

  it('preserves single quotes (no escaping needed in double-quoted AppleScript)', () => {
    expect(escapeAppleScript("it's done")).toBe("it's done");
  });
});

// ---------------------------------------------------------------------------
// escapePowerShell
// ---------------------------------------------------------------------------

describe('escapePowerShell', () => {
  it('escapes backticks', () => {
    expect(escapePowerShell('a`b')).toBe('a``b');
  });

  it('escapes dollar signs', () => {
    expect(escapePowerShell('$var')).toBe('`$var');
  });

  it('escapes double quotes', () => {
    expect(escapePowerShell('"hi"')).toBe('`"hi`"');
  });

  it('escapes all special characters together', () => {
    expect(escapePowerShell('`$"')).toBe('```$`"');
  });
});

// ---------------------------------------------------------------------------
// sendNotification
// ---------------------------------------------------------------------------

describe('sendNotification', () => {
  it('calls osascript on darwin with double-quoted AppleScript', () => {
    const exec = vi.fn();
    const log = vi.fn();

    sendNotification('say "hi"', { platform: 'darwin', exec, log });

    expect(exec).toHaveBeenCalledOnce();
    expect(exec.mock.calls[0]?.[0]).toBe('osascript');

    const script = (exec.mock.calls[0]?.[1] as readonly string[])[1];

    expect(script).toContain('display notification "say \\"hi\\""');
    expect(log).not.toHaveBeenCalled();
  });

  it('calls notify-send on linux', () => {
    const exec = vi.fn();
    const log = vi.fn();

    sendNotification('test', { platform: 'linux', exec, log });

    expect(exec).toHaveBeenCalledOnce();
    expect(exec.mock.calls[0]?.[0]).toBe('notify-send');
    expect(exec.mock.calls[0]?.[1]).toEqual(['Clancy', 'test']);
  });

  it('calls powershell with -NoProfile on win32', () => {
    const exec = vi.fn();
    const log = vi.fn();

    sendNotification('test', { platform: 'win32', exec, log });

    expect(exec).toHaveBeenCalledOnce();
    expect(exec.mock.calls[0]?.[0]).toBe('powershell');

    const args = exec.mock.calls[0]?.[1] as readonly string[];

    expect(args[0]).toBe('-NoProfile');
    expect(args[1]).toBe('-Command');
  });

  it('falls back to log on unsupported platform', () => {
    const exec = vi.fn();
    const log = vi.fn();

    sendNotification('test', { platform: 'freebsd', exec, log });

    expect(exec).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('[Clancy] test');
  });

  it('falls back to log when exec throws', () => {
    const exec = vi.fn(() => {
      throw new Error('command failed');
    });
    const log = vi.fn();

    sendNotification('test', { platform: 'darwin', exec, log });

    expect(log).toHaveBeenCalledWith('[Clancy] test');
  });

  it('passes timeout and windowsHide to exec', () => {
    const exec = vi.fn();

    sendNotification('test', {
      platform: 'linux',
      exec,
      log: vi.fn(),
    });

    const opts = exec.mock.calls[0]?.[2];

    expect(opts).toEqual({ timeout: 5000, windowsHide: true });
  });
});
