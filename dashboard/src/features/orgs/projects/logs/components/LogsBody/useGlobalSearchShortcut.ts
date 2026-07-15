import { type RefObject, useCallback } from 'react';
import { useGlobalKeyShortcut } from '@/hooks/useGlobalKeyShortcut';

interface UseGlobalSearchShortcutArgs {
  targetRef: RefObject<HTMLInputElement | null>;
}

export function useGlobalSearchShortcut({
  targetRef,
}: UseGlobalSearchShortcutArgs): void {
  const handleTrigger = useCallback(() => {
    targetRef.current?.focus();
    targetRef.current?.select();
  }, [targetRef]);

  const isEditableAllowed = useCallback(
    (active: HTMLElement | null) => active === targetRef.current,
    [targetRef],
  );

  useGlobalKeyShortcut({
    key: 'f',
    onTrigger: handleTrigger,
    isEditableAllowed,
  });
}
