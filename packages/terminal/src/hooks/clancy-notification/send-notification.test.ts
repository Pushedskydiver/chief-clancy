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
});

// ---------------------------------------------------------------------------
// escapeAppleScript
// ---------------------------------------------------------------------------

describe('escapeAppleScript', () => {
  it('escapes single quotes', () => {
    expect(escapeAppleScript("it's done")).toBe("it'\"'\"'s done");
  });

  it('returns unchanged string without quotes', () => {
    expect(escapeAppleScript('hello')).toBe('hello');
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
  it('calls osascript on darwin', () => {
    const exec = vi.fn();
    const log = vi.fn();

    sendNotification('test', { platform: 'darwin', exec, log });

    expect(exec).toHaveBeenCalledOnce();
    expect(exec.mock.calls[0]?.[0]).toBe('osascript');
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

  it('calls powershell on win32', () => {
    const exec = vi.fn();
    const log = vi.fn();

    sendNotification('test', { platform: 'win32', exec, log });

    expect(exec).toHaveBeenCalledOnce();
    expect(exec.mock.calls[0]?.[0]).toBe('powershell');
  });

  it('falls back to log on unsupported platform', () => {
    const exec = vi.fn();
    const log = vi.fn();

    sendNotification('test', { platform: 'freebsd', exec, log });

    expect(exec).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('test');
  });

  it('falls back to log when exec throws', () => {
    const exec = vi.fn(() => {
      throw new Error('command failed');
    });
    const log = vi.fn();

    sendNotification('test', { platform: 'darwin', exec, log });

    expect(log).toHaveBeenCalledWith('test');
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
