import { type RefObject, useCallback } from 'react';
import { useGlobalKeyShortcut } from '@/hooks/useGlobalKeyShortcut';
import type { ShortcutContext } from '@/hooks/useGlobalKeyShortcut';

interface UseGlobalSearchShortcutArgs {
  targetRef: RefObject<HTMLInputElement | null>;
}

export function useGlobalSearchShortcut({
  targetRef,
}: UseGlobalSearchShortcutArgs): void {
  const handleShortcut = useCallback(() => {
    targetRef.current?.focus();
    targetRef.current?.select();
  }, [targetRef]);

  const shouldHandleSearchShortcut = useCallback(
    ({ activeElement, isEditable }: ShortcutContext) => {
      const isTargetActive = activeElement === targetRef.current;
      return !isEditable || isTargetActive;
    },
    [targetRef],
  );

  useGlobalKeyShortcut({
    key: 'f',
    onShortcut: handleShortcut,
    shouldHandle: shouldHandleSearchShortcut,
  });
}
