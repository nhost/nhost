import { useCallback, useRef } from 'react';

function getReturnFocusTarget(): HTMLElement | null {
  let element = document.activeElement;

  // A menu item is gone by the time the modal closes, so return to its trigger.
  while (element instanceof HTMLElement) {
    const triggerId = element
      .closest('[role="menu"]')
      ?.getAttribute('aria-labelledby');
    const trigger = triggerId ? document.getElementById(triggerId) : null;

    if (!trigger) {
      break;
    }

    element = trigger;
  }

  return element instanceof HTMLElement && element !== document.body
    ? element
    : null;
}

export default function useRestoreFocus() {
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const rememberFocus = useCallback(() => {
    // Already open (e.g. content swapped): keep the original opener.
    if (returnFocusRef.current) {
      return;
    }

    returnFocusRef.current = getReturnFocusTarget();
  }, []);

  const restoreFocus = useCallback((event: Event) => {
    const element = returnFocusRef.current;
    returnFocusRef.current = null;

    if (!element?.isConnected) {
      return;
    }

    event.preventDefault();

    // Radix fires this after the exit animation; if the user focused something
    // else meanwhile (e.g. opened a menu), stealing focus back would close it.
    const active = document.activeElement;
    const content =
      event.currentTarget instanceof Node ? event.currentTarget : null;
    if (active && active !== document.body && !content?.contains(active)) {
      return;
    }

    element.focus();
  }, []);

  return { rememberFocus, restoreFocus };
}
