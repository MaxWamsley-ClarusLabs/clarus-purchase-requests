// Small React hooks shared by the screens.

import * as React from 'react';

/** True while the component is on screen, so a result that arrives after it has gone is ignored. */
export function useMountedRef(): React.MutableRefObject<boolean> {
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';

/** The elements inside `box` that Tab reaches, in order. */
function tabbable(box: HTMLElement): HTMLElement[] {
  return Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !(el as HTMLButtonElement).disabled && el.tabIndex >= 0 && el.getClientRects().length > 0
  );
}

/**
 * Keyboard use of a dialog or panel that covers the page (WAI-ARIA dialog
 * pattern): when it opens, focus moves to its first form field, else its main
 * button, else its first button; Tab and Shift+Tab stay inside it; Escape
 * closes it; and when it closes, focus goes back to what had it before, such
 * as the button that opened it. `ref` is the dialog element (give it
 * tabIndex -1). `active` false leaves the keyboard alone, for a panel that is
 * only sometimes shown over the page. A layout effect, so the focus moves as
 * the dialog appears and returns before it is removed, never resting on the
 * page in between.
 */
export function useDialogFocus(ref: React.RefObject<HTMLElement>, onClose: () => void, active = true): void {
  const close = React.useRef(onClose);
  close.current = onClose;
  React.useLayoutEffect(() => {
    if (!active) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const box = ref.current;
    if (box) {
      const items = tabbable(box);
      const start = items.find((el) => el.matches('input, select, textarea')) ?? items.find((el) => el.matches('.ctx-btn-primary')) ?? items[0] ?? box;
      start.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      const dialog = ref.current;
      if (!dialog) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = tabbable(dialog);
      const active = document.activeElement;
      if (items.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (!(active instanceof HTMLElement) || !dialog.contains(active) || active === dialog) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (opener && opener.isConnected) opener.focus();
    };
  }, [active]);
}
