/**
 * jsdom polyfill: `HTMLDialogElement.prototype.showModal` / `.close`.
 *
 * jsdom v29 ships `<dialog>` element recognition (implicit `role="dialog"`,
 * `open` attribute reflection) but does not implement the imperative
 * `showModal()` / `close()` methods. Real browsers (Chrome, Firefox,
 * Safari) all support them. Polyfilling here keeps component code
 * browser-native and lets RTL queries against the rendered tree pass.
 *
 * The polyfill mirrors the behaviour we care about for tests: `showModal`
 * sets the `open` attribute (which is what RTL observes via the implicit
 * role mapping); `close` removes it. Focus trap, top-layer rendering, and
 * inertness are out of scope — they are browser concerns, not JS API
 * surface, and tests do not verify them.
 *
 * Loaded via `setupFiles` in `vitest.config.ts`; runs once per worker
 * before any test imports.
 */

if (typeof HTMLDialogElement !== 'undefined') {
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & {
    showModal?: () => void;
    close?: () => void;
  };

  if (typeof proto.showModal !== 'function') {
    proto.showModal = function showModal(this: HTMLDialogElement): void {
      this.setAttribute('open', '');
    };
  }

  if (typeof proto.close !== 'function') {
    proto.close = function close(this: HTMLDialogElement): void {
      this.removeAttribute('open');
    };
  }
}
