import { useCallback } from 'react';
import type { ShortcutContext } from '@/hooks/useGlobalKeyShortcut';
import { useGlobalKeyShortcut } from '@/hooks/useGlobalKeyShortcut';

interface UseCommandPaletteShortcutArgs {
  open: boolean;
  onToggle: VoidFunction;
}

export const useCommandPaletteShortcut = ({
  open,
  onToggle,
}: UseCommandPaletteShortcutArgs): void => {
  // While open, the palette's own input has focus, so the editable guard must
  // not swallow the closing Cmd/Ctrl+K.
  const shouldHandle = useCallback(
    ({ isEditable }: ShortcutContext) => open || !isEditable,
    [open],
  );

  useGlobalKeyShortcut({ key: 'k', onShortcut: onToggle, shouldHandle });
};
