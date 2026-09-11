import { useEffect } from 'react';

export default function useReportDirtyChange(
  isDirty: boolean,
  onDirtyChange?: (isDirty: boolean) => void,
) {
  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);
}
