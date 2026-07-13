import { useCallback } from 'react';
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
  const isEditableAllowed = useCallback(() => open, [open]);

  useGlobalKeyShortcut({ key: 'k', onTrigger: onToggle, isEditableAllowed });
};
