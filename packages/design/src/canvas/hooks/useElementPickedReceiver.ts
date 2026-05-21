import type {
  ElementAnchor,
  ElementPickedMessage,
} from '../../schemas/element-picked.js';

import { useEffect, useState } from 'react';

import { elementPickedMessageSchema } from '../../schemas/element-picked.js';

export type IframeMap = Readonly<Record<string, HTMLIFrameElement>>;

export type ActiveComment = {
  readonly variantId: string;
  readonly anchor: ElementAnchor;
};

const parseElementPickedMessage = (
  data: unknown,
): ElementPickedMessage | null => {
  const result = elementPickedMessageSchema.safeParse(data);
  return result.success ? result.data : null;
};

/**
 * Resolve the sender's variantId via `contentWindow` identity match.
 *
 * Variant iframes ship with `sandbox="allow-scripts"`, which gives them an
 * opaque origin: `event.origin` is the literal string `"null"` on both
 * sides and cannot anchor a security check. The load-bearing identity
 * check is `iframe.contentWindow === event.source` — a compromised variant
 * cannot forge a contentWindow handle across origins.
 */
const resolveSenderVariantId = (
  iframes: IframeMap,
  source: MessageEventSource | null,
): string | null => {
  if (source === null) return null;
  const entry = Object.entries(iframes).find(
    ([, iframe]) => iframe.contentWindow === source,
  );
  return entry === undefined ? null : entry[0];
};

/**
 * Build the parent-side `message` handler for the element-pick channel.
 *
 * The validation pipeline reads as a single sequence: resolve sender →
 * structurally parse envelope (zod/mini schema) → cross-check claimed
 * variantId → commit state. Each early-return is one validation step;
 * the message must clear every step to set the active comment.
 *
 * The cross-check (`message.variantId === resolvedVariantId`) defeats
 * self-id-spoofing: a compromised variant cannot forge a `contentWindow`
 * handle across origins, so identity-matching pins the claimed variantId
 * to the verified sender.
 */
const createPickedMessageHandler = (
  iframes: IframeMap,
  setActiveComment: (next: ActiveComment) => void,
): ((event: MessageEvent) => void) => {
  return (event) => {
    const resolvedVariantId = resolveSenderVariantId(iframes, event.source);
    if (resolvedVariantId === null) return;
    const message = parseElementPickedMessage(event.data);
    if (message === null) return;
    if (message.variantId !== resolvedVariantId) return;
    setActiveComment({
      variantId: resolvedVariantId,
      anchor: message.anchor,
    });
  };
};

/**
 * Wire the parent-side receiver for `clancy:design:element-picked` messages.
 *
 * Listener teardown uses `AbortController.abort()` rather than a paired
 * `removeEventListener`: a single source-of-truth (the controller) avoids
 * the same-handler-reference invariant that `removeEventListener`
 * requires, and matches the modern DOM idiom for cleanup composition.
 */
export const useElementPickedReceiver = (
  iframes: IframeMap,
): ActiveComment | null => {
  const [activeComment, setActiveComment] = useState<ActiveComment | null>(
    null,
  );

  useEffect(() => {
    const controller = new AbortController();
    const handlePickedMessage = createPickedMessageHandler(
      iframes,
      setActiveComment,
    );
    window.addEventListener('message', handlePickedMessage, {
      signal: controller.signal,
    });
    return () => controller.abort();
  }, [iframes]);

  return activeComment;
};
