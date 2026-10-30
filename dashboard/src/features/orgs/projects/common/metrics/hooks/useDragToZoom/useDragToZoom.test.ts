import { act, renderHook } from '@/tests/testUtils';
import useDragToZoom from './useDragToZoom';

const MIN_RANGE = 10_000;

function renderDragToZoom() {
  const onZoomRange = vi.fn();
  const { result } = renderHook(() =>
    useDragToZoom({ minRange: MIN_RANGE, onZoomRange }),
  );
  const mouseDown = (activeLabel: number) =>
    act(() => result.current.handleMouseDown({ activeLabel }));
  const mouseMove = (activeLabel: number) =>
    act(() => result.current.handleMouseMove({ activeLabel }));
  const mouseUp = () => act(() => result.current.handleMouseUp());
  return { result, onZoomRange, mouseDown, mouseMove, mouseUp };
}

describe('useDragToZoom', () => {
  it('zooms to the dragged range, earliest timestamp first', () => {
    const { result, onZoomRange, mouseDown, mouseMove, mouseUp } =
      renderDragToZoom();

    mouseDown(60_000);
    mouseMove(0);
    expect(result.current.selection).toEqual({ from: 0, to: 60_000 });
    mouseUp();

    expect(onZoomRange).toHaveBeenCalledWith(0, 60_000);
    expect(result.current.selection).toBeNull();
  });

  it('does not zoom into a range shorter than minRange', () => {
    const { onZoomRange, mouseDown, mouseMove, mouseUp } = renderDragToZoom();

    mouseDown(0);
    mouseMove(MIN_RANGE - 1);
    mouseUp();

    expect(onZoomRange).not.toHaveBeenCalled();
  });

  it('swallows only the click that ends a drag', () => {
    const { result, mouseDown, mouseMove, mouseUp } = renderDragToZoom();

    mouseDown(0);
    mouseMove(60_000);
    mouseUp();

    expect(result.current.consumeDragClick()).toBe(true);
    expect(result.current.consumeDragClick()).toBe(false);
  });

  it('does not zoom on a click after a drag released outside the chart', () => {
    const { result, onZoomRange, mouseDown, mouseMove, mouseUp } =
      renderDragToZoom();

    // Releasing outside the chart never fires mouse-up.
    mouseDown(0);
    mouseMove(120_000);

    mouseDown(120_000);
    expect(result.current.selection).toBeNull();
    mouseUp();

    expect(onZoomRange).not.toHaveBeenCalled();
    expect(result.current.consumeDragClick()).toBe(false);
  });
});
