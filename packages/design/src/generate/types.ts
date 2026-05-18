/**
 * Shared types for `src/generate/*` — Phase F slice 10.
 *
 * `MessagesClient` is intentionally a minimal structural interface over the
 * subset of `@anthropic-ai/sdk`'s `client.messages.create` surface we use.
 * The real SDK object satisfies this interface; tests pass a mock with
 * `vi.fn()` for `create`. Keeping the interface narrow shields callers from
 * SDK version drift on fields we don't touch and avoids leaking the SDK's
 * full type surface through our public API.
 */

export type GenerateInput = {
  readonly variantId: string;
  readonly seed: string;
  readonly sessionId: string;
  readonly isFirstIteration: boolean;
  readonly designContext: string;
  readonly priorVariant?: string;
  readonly comments?: string;
  readonly model?: 'sonnet' | 'opus';
};

export type Variant = {
  readonly id: string;
  readonly seed: string;
  readonly html: string;
  readonly rationale: string;
};

type SystemBlock = {
  readonly type: 'text';
  readonly text: string;
  readonly cache_control?: { readonly type: 'ephemeral' };
};

export type MessagesCreateParams = {
  readonly model: string;
  readonly max_tokens: number;
  readonly system?: string | readonly SystemBlock[];
  readonly messages: readonly {
    readonly role: 'user';
    readonly content: string;
  }[];
};

export type MessagesResponse = {
  readonly content: readonly {
    readonly type: string;
    readonly text?: string;
  }[];
};

export type MessagesClient = {
  create(params: MessagesCreateParams): Promise<MessagesResponse>;
};
