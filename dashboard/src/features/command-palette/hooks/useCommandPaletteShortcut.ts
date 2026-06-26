import { useEffect } from 'react';

interface UseCommandPaletteShortcutArgs {
  onToggle: VoidFunction;
}

export const useCommandPaletteShortcut = ({
  onToggle,
}: UseCommandPaletteShortcutArgs): void => {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }

      if (event.key.toLowerCase() !== 'k') {
        return;
      }

      const active = document.activeElement as HTMLElement | null;
      const isEditable =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        active?.isContentEditable === true;

      if (isEditable) {
        return;
      }

      event.preventDefault();
      onToggle();
    };

    window.addEventListener('keydown', handler);

    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [onToggle]);
};
