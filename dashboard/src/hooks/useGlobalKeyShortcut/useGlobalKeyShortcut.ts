import { useEffect } from 'react';

interface UseGlobalKeyShortcutArgs {
  key: string;
  onTrigger: VoidFunction;
  isEditableAllowed?: (active: HTMLElement | null) => boolean;
}

export default function useGlobalKeyShortcut({
  key,
  onTrigger,
  isEditableAllowed,
}: UseGlobalKeyShortcutArgs): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }

      if (event.key.toLowerCase() !== key.toLowerCase()) {
        return;
      }

      const active = document.activeElement as HTMLElement | null;
      const isEditable =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        active?.isContentEditable === true;

      if (isEditable && !isEditableAllowed?.(active)) {
        return;
      }

      event.preventDefault();
      onTrigger();
    };

    window.addEventListener('keydown', handler);

    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [key, onTrigger, isEditableAllowed]);
}
