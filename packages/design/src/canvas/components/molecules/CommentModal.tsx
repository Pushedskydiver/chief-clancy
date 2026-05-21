import type { BoundingBox } from '../../../schemas/element-picked.js';
import type { CSSProperties, ReactElement } from 'react';

import { useEffect, useRef } from 'react';

const computeModalStyle = (boundingBox: BoundingBox): CSSProperties => ({
  position: 'fixed',
  top: boundingBox.top + boundingBox.height,
  left: boundingBox.left,
});

type CommentModalProps = {
  readonly boundingBox: BoundingBox;
};

/**
 * Comment input modal anchored just below the picked element's bounding
 * box.
 *
 * Uses the native `<dialog>` element opened imperatively via
 * `showModal()`: this is the WCAG-correct modal contract. The browser
 * exposes the dialog as modal to assistive technology, renders it in the
 * top layer, inerts the rest of the page, traps focus inside the dialog,
 * and binds ESC to close — semantics that `<dialog open>` (the
 * declarative form) does not provide. MDN's documentation for `<dialog>`
 * explicitly recommends `.show()` / `.showModal()` over the `open`
 * attribute.
 *
 * Renders fixed-positioned at `(boundingBox.left, boundingBox.top +
 * boundingBox.height)` — i.e. directly under the picked element — so the
 * pick context stays visible while the user types. The textarea is
 * uncontrolled; value persistence is owned by a downstream layer.
 */
export const CommentModal = ({
  boundingBox,
}: CommentModalProps): ReactElement => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null || dialog.open) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Comment input"
      style={computeModalStyle(boundingBox)}
    >
      <textarea aria-label="Comment text" />
    </dialog>
  );
};
