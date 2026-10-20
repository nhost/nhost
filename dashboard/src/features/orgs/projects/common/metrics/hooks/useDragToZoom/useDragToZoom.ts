import { useRef, useState } from 'react';
import type { ChartMouseEvent } from '@/features/orgs/projects/common/metrics/types';

interface DragToZoomSelection {
  from: number;
  to: number;
}

interface UseDragToZoomOptions {
  // Selections shorter than this are ignored, so a near-zero drag distance
  // doesn't zoom into a hairline. A drag that starts and ends on the same data
  // point is always a click, not a zoom.
  minRange?: number;
  onZoomRange?: (from: number, to: number) => void;
}

export default function useDragToZoom({
  minRange = 0,
  onZoomRange,
}: UseDragToZoomOptions) {
  // A ref, so a plain click doesn't re-render the chart.
  const anchorRef = useRef<number | null>(null);
  const draggedRef = useRef(false);
  const [selection, setSelection] = useState<DragToZoomSelection | null>(null);

  const handleMouseDown = (event: ChartMouseEvent) => {
    const timestamp = Number(event?.activeLabel);
    if (Number.isNaN(timestamp)) {
      return;
    }
    anchorRef.current = timestamp;
    draggedRef.current = false;
  };

  const handleMouseMove = (event: ChartMouseEvent) => {
    const anchor = anchorRef.current;
    const timestamp = Number(event?.activeLabel);
    if (anchor === null || Number.isNaN(timestamp)) {
      return;
    }
    if (timestamp !== anchor) {
      draggedRef.current = true;
    }
    if (draggedRef.current) {
      setSelection({
        from: Math.min(anchor, timestamp),
        to: Math.max(anchor, timestamp),
      });
    }
  };

  const handleMouseUp = () => {
    anchorRef.current = null;
    if (!selection) {
      return;
    }
    setSelection(null);
    const { from, to } = selection;
    if (from === to || to - from < minRange) {
      return;
    }
    onZoomRange?.(from, to);
  };

  // Releasing a drag also fires a click on the chart; callers use this to
  // swallow that one click instead of pinning a tooltip.
  const consumeDragClick = () => {
    const dragged = draggedRef.current;
    draggedRef.current = false;
    return dragged;
  };

  return {
    selection,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    consumeDragClick,
  };
}
