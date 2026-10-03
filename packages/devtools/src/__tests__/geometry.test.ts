import { describe, expect, it } from '@jest/globals';
import {
  clampAnchor,
  growthOffset,
  HANDLE,
  ICON,
  isVertical,
  NARROW,
  PAD,
  restingCenter,
  STRIP,
  tooltipStyle,
} from '../geometry';
import { EDGES, type Edge } from '../types';

// Mirrors the private constant in geometry.ts: both ends of the strip must
// clear the viewport by this much.
const VIEWPORT_MARGIN = 8;
// Distances from the handle anchor to the near and far ends of the strip, the
// same derivation geometry.ts keeps private.
const ANCHOR_NEAR = HANDLE / 2;
const ANCHOR_FAR = STRIP - HANDLE / 2;

const VW = 1000;
const VH = 800;

// Reproduces renderPosition() in toolbar.ts: the tab is placed by its clamped
// anchor plus the growth offset, drawn NARROW x STRIP (long side along the
// edge), and centred on that point by `translate: -50% -50%`. A roomy viewport
// with a centred offset keeps clampAnchor a no-op so the box reflects the rest
// position directly.
function renderedBox(edge: Edge, offset: number, vw: number, vh: number) {
  const rest = restingCenter(edge, offset, vw, vh);
  const anchor = clampAnchor(edge, rest.cx, rest.cy, vw, vh);
  const growth = growthOffset(edge);
  const upright = isVertical(edge);
  const left = anchor.cx + growth.dx;
  const top = anchor.cy + growth.dy;
  const width = upright ? NARROW : STRIP;
  const height = upright ? STRIP : NARROW;
  return {
    anchor,
    left: left - width / 2,
    right: left + width / 2,
    top: top - height / 2,
    bottom: top + height / 2,
  };
}

describe('restingCenter with growthOffset', () => {
  it('keeps the connected side flush against its edge', () => {
    expect(renderedBox('left', 50, VW, VH).left).toBe(0);
    expect(renderedBox('right', 50, VW, VH).right).toBe(VW);
    expect(renderedBox('top', 50, VW, VH).top).toBe(0);
    expect(renderedBox('bottom', 50, VW, VH).bottom).toBe(VH);
  });

  it('lands the handle centre on the anchor', () => {
    for (const edge of EDGES) {
      const box = renderedBox(edge, 50, VW, VH);
      // The handle is pinned to the anchor at the strip's near end; its centre
      // sits HANDLE / 2 past that end along the strip's axis.
      const handleCenter = isVertical(edge)
        ? box.top + HANDLE / 2
        : box.left + HANDLE / 2;
      const expected = isVertical(edge) ? box.anchor.cy : box.anchor.cx;
      expect(handleCenter).toBe(expected);
    }
  });
});

describe('clampAnchor', () => {
  it('holds both strip ends VIEWPORT_MARGIN clear on vertical edges', () => {
    const low = clampAnchor('left', 16, -1000, VW, VH);
    expect(low.cy - ANCHOR_NEAR).toBe(VIEWPORT_MARGIN);
    const high = clampAnchor('right', VW - 16, 1_000_000, VW, VH);
    expect(VH - (high.cy + ANCHOR_FAR)).toBe(VIEWPORT_MARGIN);
  });

  it('holds both strip ends VIEWPORT_MARGIN clear on horizontal edges', () => {
    const low = clampAnchor('top', -1000, 16, VW, VH);
    expect(low.cx - ANCHOR_NEAR).toBe(VIEWPORT_MARGIN);
    const high = clampAnchor('bottom', 1_000_000, VH - 16, VW, VH);
    expect(VW - (high.cx + ANCHOR_FAR)).toBe(VIEWPORT_MARGIN);
  });

  it('leaves the cross-edge coordinate untouched', () => {
    expect(clampAnchor('left', 16, 5000, VW, VH).cx).toBe(16);
    expect(clampAnchor('top', 5000, 16, VW, VH).cy).toBe(16);
  });

  it('centres the tab when the viewport is shorter than the strip', () => {
    // Under ~154px on the strip's axis both margins cannot fit, so the tab is
    // centred instead of clamped (the max < min branch). Reachable on a small
    // phone in landscape.
    const min = VIEWPORT_MARGIN + ANCHOR_NEAR;

    const shortV = clampAnchor('left', 16, 400, VW, 120);
    const maxV = 120 - VIEWPORT_MARGIN - ANCHOR_FAR;
    expect(shortV.cy).toBe((min + maxV) / 2);

    const shortH = clampAnchor('top', 400, 16, 120, VH);
    const maxH = 120 - VIEWPORT_MARGIN - ANCHOR_FAR;
    expect(shortH.cx).toBe((min + maxH) / 2);
  });
});

describe('tooltipStyle', () => {
  it('aligns the tooltip with the handle centre at position 0', () => {
    const center = `${PAD + ICON / 2}px`;
    expect(tooltipStyle('left', 0).top).toBe(center);
    expect(tooltipStyle('right', 0).top).toBe(center);
    expect(tooltipStyle('top', 0).left).toBe(center);
    expect(tooltipStyle('bottom', 0).left).toBe(center);
  });
});
