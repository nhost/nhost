// Page-level effect engine for the screenshot tool.
//
// All visual layers (the dim mask, the per-element outlines, the picker's hover
// box) are appended to `document.body` and positioned in *document*
// coordinates. captureVisibleTab rasterises the live, on-screen pixels, so
// document-space layers line up with the content exactly as rendered.

const SVG_NS = 'http://www.w3.org/2000/svg';
const NOCAPTURE_ATTR = 'data-nhost-ss-nocapture';

// The "no visible outline" sentinel: an 8-digit hex with zero alpha. When an
// outline carries this color it renders as a white dotted on-screen guide but
// is omitted from the captured pixels (see render()).
const TRANSPARENT_COLOR = '#00000000';

function isTransparent(color: string): boolean {
  return color.toLowerCase() === TRANSPARENT_COLOR;
}

// The transparent "no outline" guide is drawn as a dashed SVG stroke instead of
// a CSS dotted border, so the dash length and gap are tunable independently of
// the line width (a dotted border ties both to the width). Round caps keep the
// dashes reading as elongated dots.
const GUIDE_DASH = 5;
const GUIDE_GAP = 8;

function dashedGuideSvg(
  w: number,
  h: number,
  radius: number,
  strokeWidth: number,
): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  svg.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;';
  const inset = strokeWidth / 2;
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', String(inset));
  rect.setAttribute('y', String(inset));
  rect.setAttribute('width', String(Math.max(0, w - strokeWidth)));
  rect.setAttribute('height', String(Math.max(0, h - strokeWidth)));
  rect.setAttribute('rx', String(Math.max(0, radius - inset)));
  rect.setAttribute('fill', 'none');
  rect.setAttribute('stroke', '#ffffff');
  rect.setAttribute('stroke-width', String(strokeWidth));
  rect.setAttribute('stroke-linecap', 'round');
  rect.setAttribute('stroke-dasharray', `${GUIDE_DASH} ${GUIDE_GAP}`);
  svg.appendChild(rect);
  return svg;
}

// Select-mode cursor: a left-facing dark arrowhead (the system pointer with its
// tail removed) with a thin white edge and soft shadow so it stays legible over
// any page color. The hotspot sits at the tip. The same path is drawn twice —
// a wider white stroke under a narrower dark stroke — so the rounded corners
// (set by the dark stroke-width) stay independent of the white border thickness
// (the difference between the two widths), giving thin, default-pointer-like
// outline that hugs the rounded shape. The viewBox is padded so the outward
// strokes and shadow don't clip.
const PICK_CURSOR_SVG =
  "<svg width='19.8' height='21.6' viewBox='-50 -50 500 540' fill='none' xmlns='http://www.w3.org/2000/svg'><g filter='url(#f)'><path d='M39.9744 31.8759C38.2182 23.4825 47.2034 16.9545 54.6432 21.2183L351.11 191.127C358.653 195.45 357.401 206.692 349.09 209.248L205.199 253.511C202.971 254.196 201.054 255.643 199.785 257.599L127.77 368.534C122.94 375.973 111.523 373.84 109.707 365.158L39.9744 31.8759Z' fill='white' stroke='white' stroke-width='100' stroke-linejoin='round' stroke-linecap='round'/><path d='M39.9744 31.8759C38.2182 23.4825 47.2034 16.9545 54.6432 21.2183L351.11 191.127C358.653 195.45 357.401 206.692 349.09 209.248L205.199 253.511C202.971 254.196 201.054 255.643 199.785 257.599L127.77 368.534C122.94 375.973 111.523 373.84 109.707 365.158L39.9744 31.8759Z' fill='#333333' stroke='#333333' stroke-width='44' stroke-linejoin='round' stroke-linecap='round'/></g><defs><filter id='f' x='-90' y='-90' width='580' height='620' filterUnits='userSpaceOnUse' color-interpolation-filters='sRGB'><feFlood flood-opacity='0' result='bg'/><feColorMatrix in='SourceAlpha' type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0' result='hardAlpha'/><feOffset dy='20'/><feGaussianBlur stdDeviation='20'/><feColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.28 0'/><feBlend mode='normal' in2='bg' result='e1'/><feBlend mode='normal' in='SourceGraphic' in2='e1' result='shape'/></filter></defs></svg>";
const PICK_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(PICK_CURSOR_SVG)}") 3 2, default`;

export interface EffectOptions {
  /** Whether the background dim is applied. Off by default — opt in via the toolbar. */
  dimEnabled: boolean;
  /** Dim strength when enabled: 0 = none, 1 = fully black background. */
  dim: number;
  /** Extra px of breathing room added around each spotlit element. */
  padding: number;
  /** Border radius (px) of the cutout and outline. */
  radius: number;
  /** Draw an accent outline around each spotlit element. */
  outline: boolean;
  outlineColor: string;
  outlineWidth: number;
  /** Viewport px to exclude from the dim at the top, so fixed chrome (the
   * toolbar) is never darkened. Reset to 0 right before a capture. */
  topInset: number;
}

export const DEFAULT_OPTIONS: EffectOptions = {
  dimEnabled: false,
  dim: 0.6,
  padding: 0,
  radius: 8,
  outline: true,
  outlineColor: '#ffffff',
  outlineWidth: 2,
  topInset: 0,
};

interface DocRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A spotlit element together with the outline color, padding, line thickness
 * and corner radius chosen at the moment it was picked. The toolbar's current
 * settings seed new picks only; existing entries keep their own values. */
export interface SelectionEntry {
  el: Element;
  color: string;
  padding: number;
  outlineWidth: number;
  radius: number;
}

function docRect(el: Element, padding: number): DocRect {
  const r = el.getBoundingClientRect();
  return {
    x: r.left + window.scrollX - padding,
    y: r.top + window.scrollY - padding,
    w: r.width + padding * 2,
    h: r.height + padding * 2,
  };
}

// Viewport-space rect (no scroll offset). Used for the outline + hover layers,
// which are positioned `fixed` so they stay correct regardless of how the page
// styles <body> (e.g. `position: relative`, which would otherwise make body the
// containing block for absolutely-positioned layers and shift them by the
// toolbar push-down). The dim cutouts stay in document space (docRect) because
// their svg is fixed and translated by scroll.
function viewRect(el: Element, padding: number): DocRect {
  const r = el.getBoundingClientRect();
  return {
    x: r.left - padding,
    y: r.top - padding,
    w: r.width + padding * 2,
    h: r.height + padding * 2,
  };
}

export class OverlayController {
  private active = false;
  private picking = false;
  // True only during a capture. While set, transparent outlines (the on-screen
  // white dotted guides) are skipped so they are absent from the screenshot.
  private capturing = false;
  private readonly selected: SelectionEntry[] = [];
  // Snapshots of `selected` taken before each selection-changing action, so the
  // toolbar's Undo can step back one pick/unpick/clear at a time.
  private readonly history: SelectionEntry[][] = [];
  private options: EffectOptions = { ...DEFAULT_OPTIONS };

  private root: HTMLDivElement | null = null;
  private dimWindow: HTMLDivElement | null = null;
  private dimSvg: SVGSVGElement | null = null;
  private maskRects: SVGRectElement[] = [];
  private dimRect: SVGRectElement | null = null;
  private outlineLayer: HTMLDivElement | null = null;
  private hoverBox: HTMLDivElement | null = null;
  // The page element currently under the cursor while picking. When it is
  // already selected, render() flips its spotlight to "click to remove".
  private hoveredEl: Element | null = null;
  private rafId = 0;
  // Global stylesheet that forces the pick cursor over every element while
  // picking. document.body.style.cursor alone loses to elements with their own
  // cursor (links default to `pointer`), so an `!important` rule on `*` is
  // needed to win the cascade.
  private cursorStyleEl: HTMLStyleElement | null = null;

  /** Notified whenever the selection set changes (count for the UI). */
  onSelectionChange: (count: number) => void = () => {};
  /** Notified whenever picking mode is entered/left (for the UI toggle). */
  onPickingChange: (picking: boolean) => void = () => {};

  private readonly handleMove = (event: MouseEvent) =>
    this.onPointerMove(event);
  private readonly handleClick = (event: MouseEvent) =>
    this.onPointerClick(event);
  private readonly handleKey = (event: KeyboardEvent) => this.onKeyDown(event);
  private readonly handleReflow = () => this.scheduleReflow();

  activate(): void {
    if (this.active) {
      return;
    }
    this.active = true;
    this.buildLayers();
    window.addEventListener('scroll', this.handleReflow, true);
    window.addEventListener('resize', this.handleReflow);
    this.render();
  }

  deactivate(): void {
    if (!this.active) {
      return;
    }
    this.stopPicking();
    window.removeEventListener('scroll', this.handleReflow, true);
    window.removeEventListener('resize', this.handleReflow);
    this.root?.remove();
    this.root = null;
    this.dimWindow = null;
    this.dimSvg = null;
    this.dimRect = null;
    this.outlineLayer = null;
    this.hoverBox = null;
    this.hoveredEl = null;
    this.maskRects = [];
    this.selected.length = 0;
    this.history.length = 0;
    this.active = false;
    this.onSelectionChange(0);
  }

  setOptions(patch: Partial<EffectOptions>): void {
    this.options = { ...this.options, ...patch };
    this.render();
  }

  getOptions(): EffectOptions {
    return { ...this.options };
  }

  get selectionCount(): number {
    return this.selected.length;
  }

  get isPicking(): boolean {
    return this.picking;
  }

  clearSelection(): void {
    if (this.selected.length === 0) {
      return;
    }
    this.pushHistory();
    this.selected.length = 0;
    this.render();
    this.onSelectionChange(0);
  }

  /** Whether there is a prior selection state to step back to. */
  get canUndo(): boolean {
    return this.history.length > 0;
  }

  /** Step back to the selection state before the last pick/unpick/clear. */
  undo(): void {
    const prev = this.history.pop();
    if (!prev) {
      return;
    }
    this.selected.length = 0;
    this.selected.push(...prev);
    this.render();
    this.onSelectionChange(this.selected.length);
  }

  /** Snapshot of the undo history (oldest first) for persistence. */
  getHistory(): SelectionEntry[][] {
    return this.history.map((snap) => snap.map((s) => ({ ...s })));
  }

  /** Replace the current selection (and optionally the undo history). Used to
   * restore persisted picks after a reload or navigation; unknown/duplicate
   * elements are ignored. */
  restoreSelection(
    entries: SelectionEntry[],
    history: SelectionEntry[][] = [],
  ): void {
    this.history.length = 0;
    for (const snap of history) {
      this.history.push(snap.map((s) => ({ ...s })));
    }
    this.selected.length = 0;
    for (const entry of entries) {
      if (!this.selected.some((s) => s.el === entry.el)) {
        this.selected.push({ ...entry });
      }
    }
    this.render();
    this.onSelectionChange(this.selected.length);
  }

  getSelection(): SelectionEntry[] {
    return this.selected.map((s) => ({ ...s }));
  }

  togglePicking(): void {
    if (this.picking) {
      this.stopPicking();
    } else {
      this.startPicking();
    }
  }

  startPicking(): void {
    if (!this.active || this.picking) {
      return;
    }
    this.picking = true;
    const cursorStyle = document.createElement('style');
    cursorStyle.textContent = `*,*::before,*::after{cursor:${PICK_CURSOR} !important}`;
    (document.head ?? document.documentElement).appendChild(cursorStyle);
    this.cursorStyleEl = cursorStyle;
    document.addEventListener('mousemove', this.handleMove, true);
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('keydown', this.handleKey, true);
    this.onPickingChange(true);
  }

  stopPicking(): void {
    if (!this.picking) {
      return;
    }
    this.picking = false;
    this.cursorStyleEl?.remove();
    this.cursorStyleEl = null;
    document.removeEventListener('mousemove', this.handleMove, true);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('keydown', this.handleKey, true);
    this.clearHover();
    this.onPickingChange(false);
  }

  /** Called right before a capture so interaction-only chrome is not baked in. */
  prepareForCapture(): void {
    this.stopPicking();
    this.clearHover();
    this.capturing = true;
    this.render();
  }

  /** Called after a capture completes to restore the on-screen guides. */
  endCapture(): void {
    this.capturing = false;
    this.render();
  }

  /** Recompute every layer against the current layout. Needed when the page
   * reflows for reasons we don't listen for (e.g. the toolbar toggling the
   * document push-down right before a capture). */
  refresh(): void {
    this.render();
  }

  private buildLayers(): void {
    const root = document.createElement('div');
    root.dataset.nhostScreenshotOverlay = '';
    root.style.cssText =
      'position:absolute;inset:0;pointer-events:none;z-index:2147483000;';

    // The dim lives in a viewport-fixed window so it can be clipped to start
    // below the toolbar; the svg inside is translated to track scroll.
    const dimWindow = document.createElement('div');
    dimWindow.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;overflow:hidden;pointer-events:none;';

    const dimSvg = document.createElementNS(SVG_NS, 'svg');
    dimSvg.style.cssText =
      'position:absolute;top:0;left:0;pointer-events:none;';

    const maskId = `nhost-ss-mask-${Math.random().toString(36).slice(2)}`;
    const defs = document.createElementNS(SVG_NS, 'defs');
    const mask = document.createElementNS(SVG_NS, 'mask');
    mask.setAttribute('id', maskId);
    const maskBase = document.createElementNS(SVG_NS, 'rect');
    maskBase.setAttribute('fill', 'white');
    mask.appendChild(maskBase);
    defs.appendChild(mask);
    dimSvg.appendChild(defs);

    const dimRect = document.createElementNS(SVG_NS, 'rect');
    dimRect.setAttribute('fill', 'black');
    dimRect.setAttribute('mask', `url(#${maskId})`);
    dimSvg.appendChild(dimRect);

    const outlineLayer = document.createElement('div');
    outlineLayer.style.cssText =
      'position:fixed;top:0;left:0;pointer-events:none;';

    const hoverBox = document.createElement('div');
    hoverBox.setAttribute(NOCAPTURE_ATTR, '');
    hoverBox.style.cssText =
      'position:fixed;pointer-events:none;display:none;border:2px dashed #ffffff;background:rgba(127,127,127,0.16);box-sizing:border-box;';

    dimWindow.appendChild(dimSvg);
    root.append(dimWindow, outlineLayer, hoverBox);
    document.body.appendChild(root);

    this.root = root;
    this.dimWindow = dimWindow;
    this.dimSvg = dimSvg;
    this.dimRect = dimRect;
    this.maskRects = [maskBase];
    this.outlineLayer = outlineLayer;
    this.hoverBox = hoverBox;
  }

  private isOwnNode(node: EventTarget | null): boolean {
    if (!(node instanceof Element)) {
      return false;
    }
    // Clicks inside the control frame's ShadowRoot are retargeted to its host,
    // which carries the no-capture attribute — never treat those as picks.
    if (node.closest(`[${NOCAPTURE_ATTR}]`)) {
      return true;
    }
    return Boolean(this.root?.contains(node));
  }

  private onPointerMove(event: MouseEvent): void {
    const target = event.target;
    const el =
      target instanceof Element && !this.isOwnNode(target) ? target : null;
    const prevEntry =
      this.hoveredEl !== null
        ? this.selected.find((s) => s.el === this.hoveredEl)
        : undefined;
    const wasRemovable =
      prevEntry !== undefined && this.pendingMatches(prevEntry);
    const changed = this.hoveredEl !== el;
    this.hoveredEl = el;
    const entry =
      el !== null ? this.selected.find((s) => s.el === el) : undefined;
    const isRemovable = entry !== undefined && this.pendingMatches(entry);
    // Already-selected elements signal "click to remove" via render() (dimmed
    // spotlight + dashed outline); fresh targets get the solid hover preview.
    if (el && !isRemovable) {
      this.showHover(el);
    } else {
      this.hideHover();
    }
    if (changed && (wasRemovable || isRemovable)) {
      this.scheduleReflow();
    }
  }

  private onPointerClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element) || this.isOwnNode(target)) {
      return;
    }
    // Stop the click from navigating links / toggling page controls while picking.
    event.preventDefault();
    event.stopPropagation();
    this.toggleSelect(target);
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.stopPicking();
    }
  }

  private pushHistory(): void {
    this.history.push(this.selected.map((s) => ({ ...s })));
  }

  private isSelected(el: Element): boolean {
    return this.selected.some((s) => s.el === el);
  }

  /** Whether the toolbar's pending settings match an entry's stored settings —
   * i.e. a click would remove the spotlight rather than re-apply new settings. */
  private pendingMatches(s: SelectionEntry): boolean {
    return (
      s.color === this.options.outlineColor &&
      s.padding === this.options.padding &&
      s.outlineWidth === this.options.outlineWidth &&
      s.radius === this.options.radius
    );
  }

  private clearHover(): void {
    this.hideHover();
    if (this.hoveredEl) {
      this.hoveredEl = null;
      this.render();
    }
  }

  private toggleSelect(el: Element): void {
    this.pushHistory();
    const index = this.selected.findIndex((s) => s.el === el);
    // The *pending* settings (the toolbar's current values) seed a new pick and
    // are re-applied to an existing one whose settings differ.
    const pending = {
      color: this.options.outlineColor,
      padding: this.options.padding,
      outlineWidth: this.options.outlineWidth,
      radius: this.options.radius,
    };
    if (index >= 0) {
      const cur = this.selected[index];
      if (this.pendingMatches(cur)) {
        // Clicking an already-spotlit element with no setting changes removes it.
        this.selected.splice(index, 1);
      } else {
        // Settings changed since this element was picked: re-apply them in place
        // (an undoable step) rather than removing the spotlight.
        this.selected[index] = { el, ...pending };
      }
    } else {
      this.selected.push({ el, ...pending });
    }
    this.render();
    // Flip the cursor element's indicator immediately on (un)select instead of
    // waiting for the next mouse move.
    if (this.hoveredEl) {
      if (this.isSelected(this.hoveredEl)) {
        this.hideHover();
      } else {
        this.showHover(this.hoveredEl);
      }
    }
    this.onSelectionChange(this.selected.length);
  }

  private showHover(el: Element): void {
    if (!this.hoverBox) {
      return;
    }
    // Preview the pending padding/color so the hover box shows what the next
    // pick will actually spotlight.
    const rect = viewRect(el, this.options.padding);
    const box = this.hoverBox;
    box.style.display = 'block';
    box.style.left = `${rect.x}px`;
    box.style.top = `${rect.y}px`;
    box.style.width = `${rect.w}px`;
    box.style.height = `${rect.h}px`;
    box.style.borderRadius = `${this.options.radius}px`;
    box.replaceChildren();
    // Transparent (the default) has no visible color, so preview it with the
    // same white dashed-stroke guide used for committed picks; any chosen color
    // previews as a dashed border in that color.
    const transparent = isTransparent(this.options.outlineColor);
    if (transparent) {
      box.style.border = 'none';
      box.appendChild(
        dashedGuideSvg(
          rect.w,
          rect.h,
          this.options.radius,
          this.options.outlineWidth,
        ),
      );
    } else {
      box.style.border = `${this.options.outlineWidth}px dashed ${this.options.outlineColor}`;
    }
  }

  private hideHover(): void {
    if (this.hoverBox) {
      this.hoverBox.style.display = 'none';
    }
  }

  private scheduleReflow(): void {
    if (this.rafId) {
      return;
    }
    this.rafId = window.requestAnimationFrame(() => {
      this.rafId = 0;
      this.render();
    });
  }

  private render(): void {
    if (!this.active || !this.dimSvg || !this.dimRect || !this.outlineLayer) {
      return;
    }
    const dimSvg = this.dimSvg;
    const dimRect = this.dimRect;
    const outlineLayer = this.outlineLayer;

    const docWidth = document.documentElement.scrollWidth;
    const docHeight = document.documentElement.scrollHeight;
    const { dimEnabled, dim, outline, topInset } = this.options;

    if (this.dimWindow) {
      this.dimWindow.style.top = `${topInset}px`;
    }
    // Translate the document-sized svg so its doc-space cutouts line up with
    // the live viewport, accounting for scroll and the clipped top inset.
    dimSvg.style.transform = `translate(${-window.scrollX}px, ${-(window.scrollY + topInset)}px)`;
    dimSvg.setAttribute('width', String(docWidth));
    dimSvg.setAttribute('height', String(docHeight));
    dimRect.setAttribute('width', String(docWidth));
    dimRect.setAttribute('height', String(docHeight));
    dimRect.setAttribute('opacity', String(dimEnabled ? dim : 0));

    const mask = this.maskRects[0];
    mask.setAttribute('width', String(docWidth));
    mask.setAttribute('height', String(docHeight));

    // Each spotlit element keeps the settings chosen when it was picked. The
    // one under the cursor is flagged so we can preview its removal.
    const items = this.selected.map((s) => ({
      el: s.el,
      padding: s.padding,
      color: s.color,
      outlineWidth: s.outlineWidth,
      radius: s.radius,
      removable:
        this.picking && s.el === this.hoveredEl && this.pendingMatches(s),
    }));

    // Rebuild the mask cutouts (one black rounded rect per spotlit element).
    for (let i = 1; i < this.maskRects.length; i += 1) {
      this.maskRects[i].remove();
    }
    this.maskRects.length = 1;
    const maskEl = mask.parentNode as SVGMaskElement;
    for (const { el, padding, radius } of items) {
      const rect = docRect(el, padding);
      const cut = document.createElementNS(SVG_NS, 'rect');
      cut.setAttribute('x', String(rect.x));
      cut.setAttribute('y', String(rect.y));
      cut.setAttribute('width', String(rect.w));
      cut.setAttribute('height', String(rect.h));
      cut.setAttribute('rx', String(radius));
      cut.setAttribute('fill', 'black');
      maskEl.appendChild(cut);
      this.maskRects.push(cut);
    }

    // Rebuild the outline boxes (per-element color/thickness/radius).
    outlineLayer.replaceChildren();
    if (outline) {
      for (const {
        el,
        padding,
        color,
        outlineWidth,
        radius,
        removable,
      } of items) {
        const transparent = isTransparent(color);
        // Transparent outlines are an on-screen-only guide; omit them from the
        // capture entirely so the screenshot stays truly outline-free.
        if (transparent && this.capturing) {
          continue;
        }
        // A transparent outline is just a temporary picking guide. Once an
        // element is committed, the spotlight dimming already marks it as
        // selected, so the dashed guide only shows while the element is hovered
        // (the `removable` click-to-remove hint below). Skip it otherwise.
        if (transparent && !removable) {
          continue;
        }
        const rect = viewRect(el, padding);
        const box = document.createElement('div');
        // Keep the spotlight bright; only switch the outline to dashed to hint
        // that a click on the hovered element will remove it.
        const borderColor = transparent ? '#ffffff' : color;
        const borderStyle = removable ? 'dashed' : 'solid';
        box.style.cssText = `position:absolute;left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px;border:${outlineWidth}px ${borderStyle} ${borderColor};border-radius:${radius}px;box-sizing:border-box;`;
        outlineLayer.appendChild(box);
      }
    }
  }
}
