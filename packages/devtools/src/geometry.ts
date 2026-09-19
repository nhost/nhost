import { clamp } from './snap';
import type { Edge, Theme } from './types';

export const DRAG_THRESHOLD = 6;
export const NARROW = 32; // the thin (cross-edge) dimension of the tab
export const ICON = 24; // icon button hit area
export const GAP = 2; // gap between icon buttons, kept tiny for continuous hover
export const PAD = 18; // padding at the two ends of the strip
// The strip is always at full length; `HANDLE` is only the anchor the Nhost
// mark is pinned to, which is what keeps the toolbar still when it is dragged
// or the window is resized.
export const HANDLE = PAD * 2 + ICON;
export const STRIP = PAD * 2 + 4 * ICON + 3 * GAP; // Nhost, Hasura, mail, preferences
export const SPRING_TAU = 0.085; // position smoothing time constant, seconds

const VIEWPORT_MARGIN = 8;

// The tab grows from the handle toward one far end: down on a vertical edge,
// right on a horizontal one. These are the distances from the handle anchor to
// the tab's near end (where the handle sits) and to its far end once expanded.
const ANCHOR_NEAR = HANDLE / 2;
const ANCHOR_FAR = STRIP - HANDLE / 2;

export function isVertical(edge: Edge) {
  return edge === 'left' || edge === 'right';
}

// Resting position of the tab's centre, in viewport pixels, so the connected
// side stays flush against its edge and centred on `offset`.
export function restingCenter(
  edge: Edge,
  offset: number,
  vw: number,
  vh: number,
) {
  const half = NARROW / 2;
  switch (edge) {
    case 'left':
      return { cx: half, cy: (vh * offset) / 100 };
    case 'top':
      return { cx: (vw * offset) / 100, cy: half };
    case 'bottom':
      return { cx: (vw * offset) / 100, cy: vh - half };
    default:
      return { cx: vw - half, cy: (vh * offset) / 100 };
  }
}

// Clamp the handle anchor along the strip's axis so both ends clear the
// viewport by VIEWPORT_MARGIN.
export function clampAnchor(
  edge: Edge,
  cx: number,
  cy: number,
  vw: number,
  vh: number,
) {
  const min = VIEWPORT_MARGIN + ANCHOR_NEAR;
  if (isVertical(edge)) {
    const max = vh - VIEWPORT_MARGIN - ANCHOR_FAR;
    return { cx, cy: max < min ? (min + max) / 2 : clamp(cy, min, max) };
  }
  const max = vw - VIEWPORT_MARGIN - ANCHOR_FAR;
  return { cx: max < min ? (min + max) / 2 : clamp(cx, min, max), cy };
}

// Offset from the handle anchor to the tab's centre for the current size. The
// handle stays pinned to the anchor while the body extends past it, so the
// centre we position by moves half the extra length toward the far end.
export function growthOffset(edge: Edge) {
  const shift = (STRIP - HANDLE) / 2;
  return isVertical(edge) ? { dx: 0, dy: shift } : { dx: shift, dy: 0 };
}

// Position for the single shared tooltip, aligned with the hovered item at
// strip position `pos`, counting the handle as 0.
export function tooltipStyle(edge: Edge, pos: number): Record<string, string> {
  const center = `${PAD + pos * (ICON + GAP) + ICON / 2}px`;
  switch (edge) {
    case 'left':
      return {
        left: 'calc(100% + 12px)',
        top: center,
        transform: 'translateY(-50%)',
      };
    case 'top':
      return {
        top: 'calc(100% + 12px)',
        left: center,
        transform: 'translateX(-50%)',
      };
    case 'bottom':
      return {
        bottom: 'calc(100% + 12px)',
        left: center,
        transform: 'translateX(-50%)',
      };
    default:
      return {
        right: 'calc(100% + 12px)',
        top: center,
        transform: 'translateY(-50%)',
      };
  }
}

export function cardAnchor(edge: Edge): Record<string, string> {
  switch (edge) {
    case 'left':
      return { left: 'calc(100% + 14px)', top: '50%', translate: '0 -50%' };
    case 'top':
      return { top: 'calc(100% + 14px)', left: '50%', translate: '-50% 0' };
    case 'bottom':
      return { bottom: 'calc(100% + 14px)', left: '50%', translate: '-50% 0' };
    default:
      return { right: 'calc(100% + 14px)', top: '50%', translate: '0 -50%' };
  }
}

export function palette(theme: Theme) {
  return theme === 'light'
    ? { from: '#ffffff', to: '#e8edf4' }
    : { from: '#262a31', to: '#0b0d10' };
}
