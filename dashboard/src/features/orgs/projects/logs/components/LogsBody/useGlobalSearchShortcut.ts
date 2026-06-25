import { type RefObject, useEffect } from 'react';

interface UseGlobalSearchShortcutArgs {
  targetRef: RefObject<HTMLInputElement | null>;
}

export function useGlobalSearchShortcut({
  targetRef,
}: UseGlobalSearchShortcutArgs): void {
  useEffect(() => {
    function handler(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() !== 'f') return;

      const active = document.activeElement as HTMLElement | null;
      const isEditable =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        active?.isContentEditable === true;

      // Let the browser's native Find run if the user is typing in another
      // editable (e.g., the regex filter). Re-focusing our own search input
      // is fine.
      if (isEditable && active !== targetRef.current) return;

      event.preventDefault();
      targetRef.current?.focus();
      targetRef.current?.select();
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [targetRef]);
}
