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

/**
 * The width of an element in pixels, kept up to date as the window or the
 * page around it changes; null until the element is on screen. Give the
 * returned ref to the element.
 */
export function useElementWidth<T extends HTMLElement>(): [(element: T | null) => void, number | null] {
  const [width, setWidth] = React.useState<number | null>(null);
  const stop = React.useRef<() => void>(() => undefined);
  const ref = React.useCallback((element: T | null) => {
    stop.current();
    stop.current = () => undefined;
    if (!element) return;
    const measure = () => setWidth(element.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      stop.current = () => window.removeEventListener('resize', measure);
    } else {
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      stop.current = () => observer.disconnect();
    }
  }, []);
  React.useEffect(() => () => stop.current(), []);
  return [ref, width];
}

// An iframe is listed so the keyboard can reach a PDF shown in the file preview.
const FOCUSABLE = 'a[href], button, input, select, textarea, iframe, [tabindex]';

/** The elements inside `box` that Tab reaches, in order. */
function tabbable(box: HTMLElement): HTMLElement[] {
  return Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !(el as HTMLButtonElement).disabled && el.tabIndex >= 0 && el.getClientRects().length > 0
  );
}

/**
 * Keyboard use of a dialog or panel that covers the page (WAI-ARIA dialog
 * pattern): when it opens, focus moves to its first form field, else its main
 * button, else its first button; Tab and Shift+Tab stay inside it, a PDF shown
 * in it included; Escape closes it; and when it closes, focus goes back to
 * what had it before, such as the button that opened it. `ref` is the dialog
 * element (give it tabIndex -1). `active` false leaves the keyboard alone, for
 * a panel that is only sometimes shown over the page. A layout effect, so the
 * focus moves as the dialog appears and returns before it is removed, never
 * resting on the page in between.
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
    // Keys pressed inside a file shown in the dialog (a PDF in an iframe) do not reach this page,
    // so Tab can take the focus out of the dialog from there: it is brought back to the dialog's
    // first item, as Tab from its last item would. Focus going into another panel over the page is left alone.
    const onFocusIn = (e: FocusEvent) => {
      const dialog = ref.current;
      const target = e.target;
      if (!dialog || !(target instanceof Element) || dialog.contains(target) || target.closest('[aria-modal="true"]')) return;
      (tabbable(dialog)[0] ?? dialog).focus();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
      if (opener && opener.isConnected) opener.focus();
    };
  }, [active]);
}
