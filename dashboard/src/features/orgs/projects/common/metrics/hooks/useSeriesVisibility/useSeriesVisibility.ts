import { useCallback, useMemo, useState } from 'react';

interface LegendClickModifiers {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}

interface UseSeriesVisibilityOptions {
  keys: string[];
  // Pass both to keep the hidden series outside the chart (e.g. in the URL).
  hiddenKeys?: string[];
  onHiddenKeysChange?: (next: string[]) => void;
}

// Legend clicks, shared by every metrics chart:
// - Click: show only that series. Clicking it again shows all series.
// - ⌘/Ctrl/Shift + click: show or hide just that series. Hiding the last
//   visible series shows all of them again, so the chart is never empty.
export default function useSeriesVisibility({
  keys,
  hiddenKeys,
  onHiddenKeysChange,
}: UseSeriesVisibilityOptions) {
  const [internalHiddenKeys, setInternalHiddenKeys] = useState<string[]>([]);
  const storedHiddenKeys = hiddenKeys ?? internalHiddenKeys;
  // Series can leave the chart, for example when the time range changes. If
  // every series left would be hidden, all of them are shown instead.
  const hidden = useMemo(() => {
    const currentKeys = new Set(keys);
    const current = storedHiddenKeys.filter((key) => currentKeys.has(key));
    return current.length === keys.length ? [] : current;
  }, [storedHiddenKeys, keys]);
  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);

  const handleLegendClick = useCallback(
    (key: string, { metaKey, ctrlKey, shiftKey }: LegendClickModifiers) => {
      const setHidden = (next: string[]) => {
        onHiddenKeysChange?.(next);
        if (hiddenKeys === undefined) {
          setInternalHiddenKeys(next);
        }
      };

      if (metaKey || ctrlKey || shiftKey) {
        const next = hiddenSet.has(key)
          ? hidden.filter((k) => k !== key)
          : [...hidden, key];
        const nextHiddenSet = new Set(next);
        const hidesEverySeries = keys.every((k) => nextHiddenSet.has(k));
        setHidden(hidesEverySeries ? [] : next);
        return;
      }

      const visibleKeys = keys.filter((k) => !hiddenSet.has(k));
      const isOnlyVisible = visibleKeys.length === 1 && visibleKeys[0] === key;
      setHidden(isOnlyVisible ? [] : keys.filter((k) => k !== key));
    },
    [hidden, hiddenSet, hiddenKeys, keys, onHiddenKeysChange],
  );

  return { hiddenSet, handleLegendClick };
}
