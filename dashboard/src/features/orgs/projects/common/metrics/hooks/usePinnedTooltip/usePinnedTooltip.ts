import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChartConfig } from '@/components/ui/v3/chart';
import type {
  ChartMouseEvent,
  PinnedPayloadEntry,
  PinnedState,
} from '@/features/orgs/projects/common/metrics/types';
import type { Row } from '@/features/orgs/projects/common/metrics/utils/seriesGeometry';

interface UsePinnedTooltipOptions {
  rows: Row[];
  keys: string[];
  hiddenSet: Set<string>;
  config: ChartConfig;
}

// Mirror the hover tooltip's placement (including recharts' edge-flipping) by
// reading the live transform recharts set on its tooltip wrapper. Falls back
// to activeCoordinate + default offset if the wrapper hasn't been positioned
// yet (e.g., click without a prior hover).
function resolveTooltipPosition(
  wrapperEl: HTMLDivElement | null,
  cursor: ChartMouseEvent,
): { x: number | null; y: number | null } {
  const tooltipEl = wrapperEl?.querySelector(
    '.recharts-tooltip-wrapper',
  ) as HTMLElement | null;
  if (tooltipEl && tooltipEl.style.visibility !== 'hidden') {
    const match = tooltipEl.style.transform.match(
      /translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)/,
    );
    if (match) {
      return {
        x: Number.parseFloat(match[1]),
        y: Number.parseFloat(match[2]),
      };
    }
  }
  const fallbackX = cursor.activeCoordinate?.x ?? cursor.chartX;
  const fallbackY = cursor.activeCoordinate?.y ?? cursor.chartY;
  return {
    x: fallbackX != null ? fallbackX + 10 : null,
    y: fallbackY != null ? fallbackY + 10 : null,
  };
}

// Click-to-pin: clicking a data point pins a copy of the hover tooltip in
// place, showing the series visible at that moment. Clicking again, or
// pressing Escape, unpins it. Attach `wrapperRef` to the element that wraps
// the chart and the pinned tooltip.
export default function usePinnedTooltip({
  rows,
  keys,
  hiddenSet,
  config,
}: UsePinnedTooltipOptions) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [pinned, setPinned] = useState<PinnedState | null>(null);

  useEffect(() => {
    if (!pinned) {
      return undefined;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pinned]);

  const clearPinned = useCallback(() => setPinned(null), []);

  const togglePinAt = (e: ChartMouseEvent) => {
    const label = Number(e?.activeLabel);
    const row = rows.find((r) => r.timestamp === label);
    if (e?.activeTooltipIndex == null || !row) {
      setPinned(null);
      return;
    }

    const { x, y } = resolveTooltipPosition(wrapperRef.current, e);
    if (x == null || y == null) {
      setPinned(null);
      return;
    }

    const payload: PinnedPayloadEntry[] = keys.flatMap((key) => {
      const value = row[key];
      return !hiddenSet.has(key) && typeof value === 'number'
        ? [{ dataKey: key, name: key, value, color: config[key]?.color }]
        : [];
    });
    if (payload.length === 0) {
      setPinned(null);
      return;
    }

    setPinned((prev) => (prev ? null : { x, y, label, payload }));
  };

  return { wrapperRef, pinned, togglePinAt, clearPinned };
}
