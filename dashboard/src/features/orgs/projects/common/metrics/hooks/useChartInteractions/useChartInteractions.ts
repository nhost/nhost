import { useCallback } from 'react';
import type { ChartConfig } from '@/components/ui/v3/chart';
import { useDragToZoom } from '@/features/orgs/projects/common/metrics/hooks/useDragToZoom';
import { usePinnedTooltip } from '@/features/orgs/projects/common/metrics/hooks/usePinnedTooltip';
import { useSeriesVisibility } from '@/features/orgs/projects/common/metrics/hooks/useSeriesVisibility';
import type { ChartMouseEvent } from '@/features/orgs/projects/common/metrics/types';
import type { Row } from '@/features/orgs/projects/common/metrics/utils/seriesGeometry';

interface UseChartInteractionsOptions {
  rows: Row[];
  keys: string[];
  config: ChartConfig;
  hiddenKeys?: string[];
  onHiddenKeysChange?: (next: string[]) => void;
  minZoomRange?: number;
  onZoomRange?: (from: number, to: number) => void;
  onZoomOut?: VoidFunction;
}

// Legend filtering, click to pin a tooltip, drag to zoom and double-click to
// zoom out, wired together the same way for every metrics chart: zooming or
// changing the legend closes the pinned tooltip, and the click that ends a
// drag doesn't pin one. Charts attach the returned handlers to their chart.
export default function useChartInteractions({
  rows,
  keys,
  config,
  hiddenKeys,
  onHiddenKeysChange,
  minZoomRange,
  onZoomRange,
  onZoomOut,
}: UseChartInteractionsOptions) {
  const { hiddenSet, handleLegendClick } = useSeriesVisibility({
    keys,
    hiddenKeys,
    onHiddenKeysChange,
  });
  const pin = usePinnedTooltip({ rows, keys, hiddenSet, config });
  const zoom = useDragToZoom({
    minRange: minZoomRange,
    onZoomRange: (from, to) => {
      pin.clearPinned();
      onZoomRange?.(from, to);
    },
  });

  // A pinned tooltip is a snapshot of the series visible when it was pinned,
  // so it is closed rather than left out of sync with the legend.
  const { clearPinned } = pin;
  const handleLegendItemClick = useCallback<typeof handleLegendClick>(
    (key, modifiers) => {
      clearPinned();
      handleLegendClick(key, modifiers);
    },
    [clearPinned, handleLegendClick],
  );

  const handleClick = (event: ChartMouseEvent) => {
    if (!zoom.consumeDragClick()) {
      pin.togglePinAt(event);
    }
  };

  const handleDoubleClick = () => {
    pin.clearPinned();
    onZoomOut?.();
  };

  return {
    hiddenSet,
    pin,
    zoom,
    handleLegendItemClick,
    handleClick,
    handleDoubleClick,
  };
}
