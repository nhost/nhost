import { useEffect } from 'react';

export interface ShortcutContext {
  event: KeyboardEvent;
  activeElement: HTMLElement | null;
  isEditable: boolean;
}

interface UseGlobalKeyShortcutArgs {
  key: string;
  onShortcut: VoidFunction;
  shouldHandle?: (context: ShortcutContext) => boolean;
}

export default function useGlobalKeyShortcut({
  key,
  onShortcut,
  shouldHandle,
}: UseGlobalKeyShortcutArgs): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }

      if (event.key.toLowerCase() !== key.toLowerCase()) {
        return;
      }

      const activeElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const isEditable =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        activeElement?.isContentEditable === true;
      const context: ShortcutContext = {
        event,
        activeElement,
        isEditable,
      };

      if (!(shouldHandle ? shouldHandle(context) : !context.isEditable)) {
        return;
      }

      event.preventDefault();
      onShortcut();
    };

    window.addEventListener('keydown', handler);

    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [key, onShortcut, shouldHandle]);
}
