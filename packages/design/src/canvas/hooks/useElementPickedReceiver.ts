import { useEffect, useState } from 'react';

export type AnchorBoundingBox = {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
};

export type ElementAnchor = {
  readonly selector: string;
  readonly tag: string;
  readonly textSnippet: string;
  readonly boundingBox: AnchorBoundingBox;
};

export type ActiveComment = {
  readonly variantId: string;
  readonly anchor: ElementAnchor;
};

export type IframeMap = Readonly<Record<string, HTMLIFrameElement>>;

type ElementPickedMessage = {
  readonly type: typeof ELEMENT_PICKED_TYPE;
  readonly variantId: string;
  readonly anchor: ElementAnchor;
};

const ELEMENT_PICKED_TYPE = 'clancy:design:element-picked';

const isAnchorBoundingBox = (value: unknown): value is AnchorBoundingBox => {
  if (typeof value !== 'object' || value === null) return false;
  const bbox = value as Record<string, unknown>;
  return (
    typeof bbox.top === 'number' &&
    typeof bbox.left === 'number' &&
    typeof bbox.width === 'number' &&
    typeof bbox.height === 'number'
  );
};

const isElementAnchor = (value: unknown): value is ElementAnchor => {
  if (typeof value !== 'object' || value === null) return false;
  const anchor = value as Record<string, unknown>;
  return (
    typeof anchor.selector === 'string' &&
    typeof anchor.tag === 'string' &&
    typeof anchor.textSnippet === 'string' &&
    isAnchorBoundingBox(anchor.boundingBox)
  );
};

const isElementPickedMessage = (
  data: unknown,
): data is ElementPickedMessage => {
  if (typeof data !== 'object' || data === null) return false;
  const message = data as Record<string, unknown>;
  return (
    message.type === ELEMENT_PICKED_TYPE &&
    typeof message.variantId === 'string' &&
    isElementAnchor(message.anchor)
  );
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
 * discriminate envelope → cross-check claimed variantId → commit state.
 * Each early-return is one validation step; the message must clear every
 * step to set the active comment.
 *
 * The cross-check (`event.data.variantId === resolvedVariantId`) defeats
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
    if (!isElementPickedMessage(event.data)) return;
    if (event.data.variantId !== resolvedVariantId) return;
    setActiveComment({
      variantId: resolvedVariantId,
      anchor: event.data.anchor,
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
