// Styles for the screenshot control frame. The frame is mounted in its own
// ShadowRoot (a host appended to <html>), so these selectors are fully scoped
// and cannot leak onto — or be affected by — the page. All motion/visual
// effects are pure CSS (no JS animation).
export const FRAME_STYLES = `
:host { all: initial; }

@keyframes nhost-ss-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes nhost-ss-pop-in {
  from { opacity: 0; transform: translateY(8px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes nhost-ss-spin {
  to { transform: rotate(360deg); }
}

.nhost-ss-frame {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2147483600;
  /* 1fr / auto / 1fr keeps the center column (Select) screen-centered no matter
   * how wide the side groups are — so Select never moves when the left group
   * slides open or shut. column-gap is 0 so the segments form one seamless pill. */
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  column-gap: 0;
  /* 32px pill with 6px breathing room above and below. */
  height: 44px;
  padding: 0 12px;
  background: rgba(18, 18, 20, 0.74);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  color: #ededed;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  font-size: 12px;
  line-height: 1.4;
  box-sizing: border-box;
  /* Never let the toolbar's labels get text-selected (e.g. during a drag). */
  user-select: none;
  -webkit-user-select: none;
  /* The select-mode pick cursor is forced page-wide via an important rule on
   * the universal selector, which lands on the shadow host; cursor inherits, so
   * reset it here (and on the backdrop) so the toolbar + popovers show normal
   * cursors, not the custom one. */
  cursor: default;
}

/* Select (center) + Clear (right cap) form one black, rounded pill. The left
 * group is its OWN rounded island, separated from Select by a gap so its
 * rightmost button's hover/active highlight has room and isn't clipped. */
.nhost-ss-leftgroup {
  justify-self: end;
  /* Sits one z-layer below Select so it tucks behind it while sliding closed. */
  position: relative;
  z-index: 0;
  /* Its right edge overlaps UNDER Select (hidden by Select's higher z-index) so
   * the seam is always covered — no toolbar background ever shows between the
   * two during the slide. Extra right padding keeps the buttons clear of the
   * overlapped zone so their highlights aren't clipped. */
  margin-right: -16px;
  display: flex;
  align-items: center;
  gap: 2px;
  height: 32px;
  box-sizing: border-box;
  padding: 0 18px 0 6px;
  background: #000;
  border-radius: 999px 0 0 999px;
  /* Expand/collapse is a pure horizontal slide (no fade): at rest it sits behind
   * the Select|Clear pill (its origin, shifted right by its own width) where the
   * lower z-index keeps it occluded, and slides out to the left when summoned. */
  transition: transform 0.18s ease-in-out;
}
.nhost-ss-frame:not(.is-picking) .nhost-ss-leftgroup {
  transform: translateX(100%);
  pointer-events: none;
}
.nhost-ss-rightgroup {
  justify-self: start;
  display: flex;
  align-items: center;
  gap: 8px;
}

.nhost-ss-btn {
  appearance: none;
  border: 0;
  background: transparent;
  color: #a1a1aa;
  border-radius: 999px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 6px;
  white-space: nowrap;
  transition: background 0.15s ease, color 0.15s ease;
}
.nhost-ss-btn svg { width: 14px; height: 14px; }
.nhost-ss-btn:focus,
.nhost-ss-btn:focus-visible { outline: none; }
.nhost-ss-btn:hover { background: rgba(255, 255, 255, 0.08); color: #ededed; }
.nhost-ss-btn.is-active {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}
.nhost-ss-btn.is-primary {
  background: #fff;
  color: #000;
}
.nhost-ss-btn.is-primary:hover { background: #e5e5e5; color: #000; }

/* Select + Clear are pill segments: black fill, square inner edges, flush with
 * their neighbours. These come after .nhost-ss-btn so they win the cascade. */
.nhost-ss-select,
.nhost-ss-clear {
  position: relative;
  height: 32px;
  box-sizing: border-box;
  background: #000;
  border-radius: 0;
  outline: none;
  transition: background 0.15s ease, color 0.15s ease;
}
/* No press-scale on the pill segments: shrinking Select would open a gap at the
 * Clear seam (a flickering vertical line). The ::before handles press feedback. */
.nhost-ss-select:active,
.nhost-ss-clear:active { transform: none; }
/* Hover / active state is an inset rounded pill drawn over the black segment
 * (matching the small toggle buttons), so the segment fill stays seamless. */
.nhost-ss-select:hover,
.nhost-ss-clear:hover,
.nhost-ss-select.is-active {
  background: #000;
  color: #fff;
}
.nhost-ss-select:hover::before,
.nhost-ss-clear:hover::before,
.nhost-ss-select.is-active::before {
  content: '';
  position: absolute;
  inset: 4px 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  pointer-events: none;
}
.nhost-ss-select.is-active::before {
  background: rgba(255, 255, 255, 0.14);
}
.nhost-ss-select > span,
.nhost-ss-clear > span {
  position: relative;
}
/* Select always carries the rounded left cap, left border and shadow. The left
 * group is a separate island to its left (with a gap), so Select's cap stays
 * visible in both modes. */
.nhost-ss-select {
  padding-left: 23px;
  padding-right: 23px;
  border-radius: 999px 0 0 999px;
  /* Above the left group so the group tucks behind it when sliding closed. */
  z-index: 1;
}
/* Clear is the pill's right cap. */
.nhost-ss-clear {
  padding-left: 20px;
  padding-right: 20px;
  border-radius: 0 999px 999px 0;
  /* Above the left group so it stays hidden behind the pill while sliding. */
  z-index: 1;
}
/* Keep the cap solid when Clear is disabled — dim only its label. The extra
 * .nhost-ss-frame ancestor outweighs the later .nhost-ss-btn:disabled rule. */
.nhost-ss-frame .nhost-ss-clear:disabled {
  opacity: 1;
  color: #6b6b70;
}

/* Capture: an icon-only primary action — black tile, white camera. */
.nhost-ss-capture {
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 50%;
  background: #000;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.14);
}
.nhost-ss-capture:hover { background: #1a1a1a; color: #fff; }
.nhost-ss-capture svg { width: 16px; height: 16px; }

/* The outline-color swatch button (sits in Select's icon slot, left of it). */
.nhost-ss-outline-btn { padding: 5px 8px; }
.nhost-ss-outline-swatch {
  width: 14px;
  height: 14px;
  flex: none;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.35);
}
/* Transparent (no outline): a white disc with a red diagonal slash, matching
 * the "No outline" swatch in the color popover. */
.nhost-ss-outline-swatch.is-transparent {
  position: relative;
  overflow: hidden;
  background: #fff;
}
.nhost-ss-outline-swatch.is-transparent::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 150%;
  height: 1.5px;
  background: #ff3b30;
  transform: translate(-50%, -50%) rotate(-45deg);
}

/* Shared popover (opened from the color swatch): a solid dark card matching the
 * save modal's surface, with the color row on top and the settings sliders
 * below, so it reads dark over light pages too. */
.nhost-ss-color-pop {
  position: fixed;
  display: flex;
  flex-direction: column;
  gap: 11px;
  width: fit-content;
  max-width: 320px;
  padding: 12px 14px;
  background: #14171e;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  z-index: 2147483602;
  /* Fade + slight rise on open and close. Kept off display:none so the close
   * direction can transition too; visibility is delayed until the fade ends. */
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(-6px) scale(0.98);
  transform-origin: top left;
  transition: opacity 0.12s ease-in-out, transform 0.12s ease-in-out,
    visibility 0s linear 0.12s;
}
.nhost-ss-color-pop.is-open {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translateY(0) scale(1);
  transition: opacity 0.12s ease-in-out, transform 0.12s ease-in-out;
}
/* Header: drag handle on the left (title) and a close button on the right. */
.nhost-ss-pop-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 1px;
  cursor: grab;
  user-select: none;
}
.nhost-ss-pop-head.is-dragging { cursor: grabbing; }
.nhost-ss-pop-title {
  font-size: 12px;
  font-weight: 600;
  color: #a1a1aa;
}
.nhost-ss-pop-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #a1a1aa;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}
.nhost-ss-pop-close:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }
.nhost-ss-pop-close:focus,
.nhost-ss-pop-close:focus-visible { outline: none; }
.nhost-ss-pop-close svg { width: 13px; height: 13px; }
/* Row of round color swatches below the header. Spread evenly across the full
 * popover width so the six circles are uniformly distributed. */
.nhost-ss-color-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.nhost-ss-swatch {
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.18);
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.nhost-ss-swatch:hover { transform: scale(1.12); }
.nhost-ss-swatch.is-active {
  box-shadow: 0 0 0 2px #0d99ff;
}
.nhost-ss-swatch--transparent {
  position: relative;
  overflow: hidden;
  background: #fff;
}
.nhost-ss-swatch--transparent::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 140%;
  height: 2px;
  background: #ff3b30;
  transform: translate(-50%, -50%) rotate(-45deg);
}
/* Empty history slot: a faint, non-interactive placeholder that keeps the row
 * a constant width regardless of how many colors have been saved. */
.nhost-ss-swatch--empty {
  border-color: rgba(255, 255, 255, 0.25);
  box-shadow: none;
  background: transparent;
  cursor: default;
}
.nhost-ss-swatch--empty:hover { transform: none; }
.nhost-ss-swatch--custom {
  position: relative;
  overflow: hidden;
  background: conic-gradient(from 0deg, #ff4d4d, #ffd24d, #4dff88, #4dd2ff, #4d4dff, #ff4dff, #ff4d4d);
}
/* While picking, the custom swatch shows the previewed color (set inline) with
 * a checkmark overlay, signalling that it now confirms the pick. */
.nhost-ss-swatch-check {
  display: flex;
  position: absolute;
  inset: 0;
  align-items: center;
  justify-content: center;
  color: #fff;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease-in-out;
  /* Black outline so the white check stays visible over bright picks. A small
   * blur radius on each offset anti-aliases the corners without the soft halo
   * of a zero-offset shadow bleeding onto the swatch. */
  filter: drop-shadow(1.2px 0 0.5px #000) drop-shadow(-1.2px 0 0.5px #000)
    drop-shadow(0 1.2px 0.5px #000) drop-shadow(0 -1.2px 0.5px #000);
}
.nhost-ss-swatch--custom.is-confirming { background-image: none; }
.nhost-ss-swatch--custom.is-confirming .nhost-ss-swatch-check { opacity: 1; }
.nhost-ss-swatch-check svg { width: 14px; height: 14px; }
.nhost-ss-color-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  border: 0;
  padding: 0;
  cursor: pointer;
}

/* Settings: labelled, stop-snapping sliders rendered below the color row in the
 * shared popover. */
.nhost-ss-set-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.nhost-ss-set-label {
  flex: 0 0 96px;
  font-size: 12px;
  font-weight: 600;
  color: #ededed;
  white-space: nowrap;
}
/* The readout and its editor share an identical box (same height, border-box,
 * no border) so swapping to edit mode never changes the row height. */
.nhost-ss-set-val,
.nhost-ss-set-val-input {
  flex: 0 0 26px;
  width: 26px;
  box-sizing: border-box;
  height: 16px;
  line-height: 16px;
  padding: 0 4px;
  border: 0;
  border-radius: 5px;
  text-align: right;
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  background: rgba(255, 255, 255, 0.08);
}
.nhost-ss-set-val {
  color: #a1a1aa;
  cursor: pointer;
  transition: color 0.12s ease;
}
.nhost-ss-set-val:hover { color: #ededed; }
.nhost-ss-set-val-input {
  display: none;
  color: #ededed;
  background: rgba(255, 255, 255, 0.16);
  outline: none;
}
.nhost-ss-set-reset {
  justify-content: center;
  padding: 3px 12px;
  background: rgba(255, 255, 255, 0.06);
  color: #ededed;
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.nhost-ss-set-reset:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }

/* Footer row: "Hotkey setup" (left) + Reset all (right). */
.nhost-ss-set-footer { justify-content: space-between; margin-top: 2px; }

/* Range slider styled for the dark popover; the track + white thumb read over
 * both light and dark pages. */
.nhost-ss-slider {
  -webkit-appearance: none;
  appearance: none;
  flex: 0 0 56px;
  width: 56px;
  height: 4px;
  margin: 0;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.18);
  cursor: pointer;
}
.nhost-ss-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  border: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  cursor: pointer;
}

/* Undo: an icon-only button paired with the (now text-only) Clear button.
 * Disabled outside select mode and when there is nothing to undo. */
.nhost-ss-undo { padding: 6px 9px; }
.nhost-ss-btn:disabled {
  opacity: 0.35;
  cursor: default;
  pointer-events: none;
}

/* Close: a macOS-widget style button — black X in a white circle with a dark
 * outline and a soft shadow. */
.nhost-ss-close {
  appearance: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: #000;
  color: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
  cursor: pointer;
  transition: background 0.15s ease;
}
.nhost-ss-close:hover { background: #1a1a1a; }

.nhost-ss-close svg { width: 11px; height: 11px; }

/* Toolbar close: pinned to the right edge while the controls stay centered. */
.nhost-ss-close--pinned {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
}


/* ---- Save modal ---- */
.nhost-ss-backdrop {
  position: fixed;
  inset: 0;
  cursor: default;
  z-index: 2147483601;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(8, 10, 14, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: nhost-ss-fade-in 0.18s ease;
}
.nhost-ss-modal {
  width: min(560px, 92vw);
  max-height: 88vh;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: #14171e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.6);
  color: #e6e8ec;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  animation: nhost-ss-pop-in 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}
.nhost-ss-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.nhost-ss-modal-title { font-size: 15px; font-weight: 600; color: #fff; }

.nhost-ss-preview-wrap {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  user-select: none;
  -webkit-user-select: none;
}
.nhost-ss-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 300px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: transparent;
  overflow: hidden;
}
.nhost-ss-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
  user-select: none;
  -webkit-user-select: none;
  -webkit-user-drag: none;
}
.nhost-ss-preview.is-zoomable { cursor: zoom-in; }
.nhost-ss-actbtn:disabled {
  opacity: 0.35;
  cursor: default;
  pointer-events: none;
}

/* ---- Crop overlay ---- */
.nhost-ss-crop {
  position: absolute;
  display: none;
  cursor: crosshair;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
.nhost-ss-crop.is-active { display: block; }
.nhost-ss-crop-rect {
  position: absolute;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: 4px;
  box-shadow: 0 0 0 9999px rgba(8, 10, 14, 0.55);
  cursor: grab;
}
/* Transparent resize zones — pull the corners or sides, no visible dots. */
.nhost-ss-crop-h { position: absolute; }
.nhost-ss-crop-h.is-nw { left: -9px; top: -9px; width: 18px; height: 18px; cursor: nwse-resize; }
.nhost-ss-crop-h.is-ne { right: -9px; top: -9px; width: 18px; height: 18px; cursor: nesw-resize; }
.nhost-ss-crop-h.is-se { right: -9px; bottom: -9px; width: 18px; height: 18px; cursor: nwse-resize; }
.nhost-ss-crop-h.is-sw { left: -9px; bottom: -9px; width: 18px; height: 18px; cursor: nesw-resize; }
.nhost-ss-crop-h.is-n { left: 9px; right: 9px; top: -5px; height: 10px; cursor: ns-resize; }
.nhost-ss-crop-h.is-s { left: 9px; right: 9px; bottom: -5px; height: 10px; cursor: ns-resize; }
.nhost-ss-crop-h.is-w { top: 9px; bottom: 9px; left: -5px; width: 10px; cursor: ew-resize; }
.nhost-ss-crop-h.is-e { top: 9px; bottom: 9px; right: -5px; width: 10px; cursor: ew-resize; }

/* Persistent row below the preview: Reset crop on the left; Crop on the right,
 * swapping to Cancel/Apply while cropping. Always mounted so the modal height
 * stays put when entering crop mode. */
.nhost-ss-crop-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
}
.nhost-ss-crop-left { flex: 1; min-width: 0; display: flex; }
.nhost-ss-crop-right { display: flex; gap: 8px; }
.nhost-ss-crop-bar .nhost-ss-btn {
  padding: 8px 16px;
  border-radius: 10px;
}
.nhost-ss-crop-bar .nhost-ss-btn:not(.is-primary) {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #e6e8ec;
}
.nhost-ss-crop-bar .nhost-ss-btn:not(.is-primary):hover {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}
.nhost-ss-crop-cancel,
.nhost-ss-crop-apply { display: none; }
.nhost-ss-crop-bar.is-cropping .nhost-ss-crop-toggle { display: none; }
.nhost-ss-crop-bar.is-cropping .nhost-ss-crop-cancel,
.nhost-ss-crop-bar.is-cropping .nhost-ss-crop-apply { display: flex; }
.nhost-ss-crop-bar.is-cropping .nhost-ss-crop-reset { display: none; }

/* Full-screen preview overlay: sits above the modal, click anywhere to close. */
.nhost-ss-fs {
  position: fixed;
  inset: 0;
  z-index: 2147483603;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  cursor: zoom-out;
  background: rgba(4, 6, 9, 0.92);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  animation: nhost-ss-fade-in 0.16s ease;
}
.nhost-ss-fs img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
}
.nhost-ss-spinner {
  width: 26px;
  height: 26px;
  border: 3px solid rgba(255, 255, 255, 0.18);
  border-top-color: #fff;
  border-radius: 50%;
  animation: nhost-ss-spin 0.7s linear infinite;
}

/* Single controls row: filename field, then Save as / download / copy. */
.nhost-ss-controls { display: flex; align-items: stretch; gap: 8px; }
.nhost-ss-field {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.25);
  overflow: hidden;
  transition: border-color 0.15s ease;
}
.nhost-ss-field:focus-within { border-color: rgba(255, 255, 255, 0.4); }
.nhost-ss-field input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: #e6e8ec;
  padding: 9px 11px;
  font-size: 12.5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  outline: none;
}
.nhost-ss-controls .nhost-ss-btn.is-primary {
  flex: 0 0 auto;
  padding: 0 16px;
  border-radius: 10px;
}
.nhost-ss-actbtn {
  flex: 0 0 auto;
  appearance: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border-radius: 10px;
  cursor: pointer;
  color: #e6e8ec;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: background 0.15s ease;
}
.nhost-ss-actbtn:hover { background: rgba(255, 255, 255, 0.14); }
.nhost-ss-actbtn:focus,
.nhost-ss-actbtn:focus-visible { outline: none; }
.nhost-ss-actbtn svg { width: 17px; height: 17px; }

.nhost-ss-status {
  min-height: 16px;
  font-size: 12px;
  color: #aab0bb;
  text-align: center;
  word-break: break-word;
}
.nhost-ss-status:empty { display: none; }
.nhost-ss-status.is-ok { color: #4ade80; }
.nhost-ss-status.is-err { color: #f87171; }
`;
