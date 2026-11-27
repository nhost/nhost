import { useGraphiQL } from '@graphiql/react';
import { type PointerEvent, useRef, useState } from 'react';

const DEFAULT_RATIO = 0.5;

interface UseSplitPanesOptions {
  /** Key the first pane's share of the width is saved under. */
  storageKey: string;
  /**
   * Neither pane is dragged narrower than this, in pixels. Give both panes
   * the same minimum width in CSS, so they keep it when the window narrows.
   */
  minPaneWidth: number;
}

function parseRatio(value: string | null) {
  const ratio = Number(value);

  return value && ratio > 0 && ratio < 1 ? ratio : DEFAULT_RATIO;
}

/**
 * Two panes side by side with a divider between them. Dragging the divider
 * resizes them, never below `minPaneWidth`, so neither can be hidden (unlike
 * GraphiQL's `useDragResize`, which hides a pane dragged near an edge). A
 * double click splits them evenly again. The split is saved in GraphiQL's
 * storage. Call it inside `GraphiQLProvider`.
 */
export default function useSplitPanes({
  storageKey,
  minPaneWidth,
}: UseSplitPanesOptions) {
  const storage = useGraphiQL((state) => state.storage);
  const [ratio, setRatio] = useState(() => parseRatio(storage.get(storageKey)));
  const firstRef = useRef<HTMLDivElement>(null);
  const secondRef = useRef<HTMLDivElement>(null);
  // Where the pointer grabbed the divider, from its left edge.
  const grabOffset = useRef<number | null>(null);

  function saveRatio(nextRatio: number) {
    setRatio(nextRatio);
    storage.set(storageKey, `${nextRatio}`);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    // Keeps the drag from selecting text.
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    grabOffset.current =
      event.clientX - event.currentTarget.getBoundingClientRect().left;
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (
      grabOffset.current === null ||
      !firstRef.current ||
      !secondRef.current
    ) {
      return;
    }

    const left = firstRef.current.getBoundingClientRect().left;
    const right = secondRef.current.getBoundingClientRect().right;
    const width = right - left - event.currentTarget.offsetWidth;

    // Too narrow for both at their minimum: CSS keeps them at it.
    if (width < minPaneWidth * 2) {
      return;
    }

    const firstWidth = Math.min(
      Math.max(event.clientX - grabOffset.current - left, minPaneWidth),
      width - minPaneWidth,
    );

    setRatio(firstWidth / width);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (grabOffset.current === null) {
      return;
    }

    grabOffset.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    storage.set(storageKey, `${ratio}`);
  }

  return {
    firstRef,
    secondRef,
    firstStyle: { flex: `${ratio} 1 0%` },
    secondStyle: { flex: `${1 - ratio} 1 0%` },
    dividerProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onDoubleClick: () => saveRatio(DEFAULT_RATIO),
    },
  };
}
