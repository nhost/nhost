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
    // A drag released outside the chart never fires mouse-up, so drop its
    // selection here; otherwise this click's mouse-up would zoom to it.
    setSelection(null);
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
    // Clear even when this render has no selection: Recharts runs mouse-move on
    // the next animation frame, so a selection can be set but not rendered yet.
    setSelection(null);
    if (!selection) {
      return;
    }
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
