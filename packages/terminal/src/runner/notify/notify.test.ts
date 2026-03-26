import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';

import {
  buildSlackPayload,
  buildTeamsPayload,
  isSlackWebhook,
  sendNotification,
} from './notify.js';

type FetchFn = Parameters<typeof sendNotification>[0]['fetch'];

describe('isSlackWebhook', () => {
  it('returns true for Slack URLs', () => {
    expect(isSlackWebhook('https://hooks.slack.com/services/T00/B00/xxx')).toBe(
      true,
    );
  });

  it('returns false for Teams URLs', () => {
    expect(
      isSlackWebhook('https://example.webhook.office.com/webhook/xxx'),
    ).toBe(false);
  });

  it('returns false for arbitrary URLs', () => {
    expect(isSlackWebhook('https://example.com/webhook')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isSlackWebhook('')).toBe(false);
  });

  it('returns false when hooks.slack.com appears in path or query', () => {
    expect(isSlackWebhook('https://evil.com/?hooks.slack.com')).toBe(false);
    expect(isSlackWebhook('https://evil.com/hooks.slack.com')).toBe(false);
  });

  it('returns false for invalid URLs', () => {
    expect(isSlackWebhook('not-a-url')).toBe(false);
  });

  it('returns true for subdomain of hooks.slack.com', () => {
    expect(
      isSlackWebhook('https://workspace.hooks.slack.com/services/T00/B00/xxx'),
    ).toBe(true);
  });
});

describe('buildSlackPayload', () => {
  it('builds a simple text payload', () => {
    const payload = JSON.parse(buildSlackPayload('hello'));

    expect(payload).toEqual({ text: 'hello' });
  });

  it('produces valid JSON with text field for any string', () => {
    fc.assert(
      fc.property(fc.string(), (msg) => {
        const payload = JSON.parse(buildSlackPayload(msg));
        return payload.text === msg;
      }),
    );
  });
});

describe('buildTeamsPayload', () => {
  it('builds an adaptive card payload', () => {
    const payload = JSON.parse(buildTeamsPayload('hello'));

    expect(payload.type).toBe('message');
    expect(payload.attachments).toHaveLength(1);
    expect(payload.attachments[0].contentType).toBe(
      'application/vnd.microsoft.card.adaptive',
    );
    expect(payload.attachments[0].content.body[0].text).toBe('hello');
  });

  it('sets wrap to true on the text block', () => {
    const payload = JSON.parse(buildTeamsPayload('test'));

    expect(payload.attachments[0].content.body[0].wrap).toBe(true);
  });

  it('produces valid JSON with text field for any string', () => {
    fc.assert(
      fc.property(fc.string(), (msg) => {
        const payload = JSON.parse(buildTeamsPayload(msg));
        return payload.attachments[0].content.body[0].text === msg;
      }),
    );
  });
});

describe('sendNotification', () => {
  it('sends Slack payload for slack.com webhooks', async () => {
    const fetch = vi.fn<FetchFn>().mockResolvedValue({ ok: true } as Response);

    await sendNotification({
      webhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx',
      message: 'hello',
      fetch,
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/services/T00/B00/xxx',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: 'hello' }),
      }),
    );
  });

  it('sends Teams payload for non-Slack webhooks', async () => {
    const fetch = vi.fn<FetchFn>().mockResolvedValue({ ok: true } as Response);

    await sendNotification({
      webhookUrl: 'https://example.webhook.office.com/webhook/xxx',
      message: 'hello',
      fetch,
    });

    const callBody = JSON.parse(
      (fetch.mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(callBody.type).toBe('message');
    expect(callBody.attachments[0].contentType).toBe(
      'application/vnd.microsoft.card.adaptive',
    );
  });

  it('sets Content-Type header to application/json', async () => {
    const fetch = vi.fn<FetchFn>().mockResolvedValue({ ok: true } as Response);

    await sendNotification({
      webhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx',
      message: 'test',
      fetch,
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('does not throw on fetch rejection', async () => {
    const fetch = vi.fn<FetchFn>().mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      sendNotification({
        webhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx',
        message: 'hello',
        fetch,
        warn: vi.fn(),
      }),
    ).resolves.toBeUndefined();
  });

  it('does not throw on non-ok response', async () => {
    const fetch = vi
      .fn<FetchFn>()
      .mockResolvedValue({ ok: false, status: 500 } as Response);

    await expect(
      sendNotification({
        webhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx',
        message: 'hello',
        fetch,
        warn: vi.fn(),
      }),
    ).resolves.toBeUndefined();
  });

  it('does not throw when webhook URL is empty', async () => {
    const fetch = vi
      .fn<FetchFn>()
      .mockRejectedValue(new TypeError('Invalid URL'));

    await expect(
      sendNotification({
        webhookUrl: '',
        message: 'hello',
        fetch,
        warn: vi.fn(),
      }),
    ).resolves.toBeUndefined();
  });

  it('logs warning on non-ok response', async () => {
    const warn = vi.fn();
    const fetch = vi
      .fn<FetchFn>()
      .mockResolvedValue({ ok: false, status: 403 } as Response);

    await sendNotification({
      webhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx',
      message: 'hello',
      fetch,
      warn,
    });

    expect(warn).toHaveBeenCalledWith('⚠ Notification failed: HTTP 403');
  });

  it('logs warning on fetch failure', async () => {
    const warn = vi.fn();
    const fetch = vi.fn<FetchFn>().mockRejectedValue(new Error('ECONNREFUSED'));

    await sendNotification({
      webhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx',
      message: 'hello',
      fetch,
      warn,
    });

    expect(warn).toHaveBeenCalledWith(
      '⚠ Notification failed: could not reach webhook',
    );
  });
});
