import type { CSSProperties, ReactElement } from 'react';

/**
 * Bounding-box subset of the parent-side `ElementAnchor` that
 * `CommentModal` needs for positioning. Narrowing the prop API to the
 * position primitives keeps `CommentModal` a presentational molecule per
 * Atomic Design — the modal owns "where to render" and "what controls to
 * expose," not "which DOM selector the comment is anchored to" (that
 * lives on the parent-side receiver).
 */
export type CommentAnchorBoundingBox = {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
};

const computeModalStyle = (
  boundingBox: CommentAnchorBoundingBox,
): CSSProperties => ({
  position: 'fixed',
  top: boundingBox.top + boundingBox.height,
  left: boundingBox.left,
});

type CommentModalProps = {
  readonly boundingBox: CommentAnchorBoundingBox;
};

/**
 * Comment input modal anchored just below the picked element's bounding
 * box.
 *
 * Uses the native `<dialog>` element rather than `<div role="dialog">`
 * for WCAG / semantic-HTML reasons: `<dialog>` carries the implicit
 * `role="dialog"` mapping, integrates with assistive-technology focus
 * announcement, and leaves room to upgrade to `showModal()` (focus trap +
 * ESC handling + top-layer rendering) without changing the markup
 * contract. Ships the declarative `open` form for now — no focus trap, no
 * top-layer — because the rendered structure is the load-bearing
 * deliverable and focus management is a separate concern.
 *
 * Renders fixed-positioned at `(boundingBox.left, boundingBox.top +
 * boundingBox.height)` — i.e. directly under the picked element — so the
 * pick context stays visible while the user types. The textarea is
 * uncontrolled; value persistence is owned by a downstream layer.
 */
export const CommentModal = ({
  boundingBox,
}: CommentModalProps): ReactElement => (
  <dialog
    open
    aria-label="Comment input"
    style={computeModalStyle(boundingBox)}
  >
    <textarea aria-label="Comment text" />
  </dialog>
);
