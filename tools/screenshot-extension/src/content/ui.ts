import {
  copyBlobToClipboard,
  dataUrlToBlob,
  nextRepaint,
  requestCapture,
  requestDownload,
  requestOpenShortcuts,
} from './capture.ts';
import {
  DEFAULT_OPTIONS,
  OverlayController,
  type SelectionEntry,
} from './overlay.ts';
import { FRAME_STYLES } from './styles.ts';

// Persist the chosen outline color so it survives page reloads and
// navigations. Stored in localStorage (page-origin scoped) and validated as a
// hex color on read, since the page shares that storage and could tamper with
// the value before it reaches `style.background` / the overlay.
const OUTLINE_COLOR_KEY = 'nhost-ss:outline-color';
const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;

function loadOutlineColor(): string | null {
  try {
    const value = localStorage.getItem(OUTLINE_COLOR_KEY);
    return value && HEX_COLOR.test(value) ? value : null;
  } catch {
    return null;
  }
}

function saveOutlineColor(color: string): void {
  try {
    localStorage.setItem(OUTLINE_COLOR_KEY, color);
  } catch {
    // Storage can be unavailable (privacy mode, sandboxed frames); the color
    // just won't persist there.
  }
}

// Recently-used outline colors (most recent first), shown as quick-pick swatches
// in the color popover. Persisted and validated as hex on read like the current
// color, since the page shares this storage.
const RECENT_COLORS_KEY = 'nhost-ss:recent-colors';
const MAX_RECENT_COLORS = 3;
// Transparent (no outline) is a permanent first swatch, never part of history.
// Stored as 8-digit hex so it passes HEX_COLOR validation on persist/read.
const TRANSPARENT_COLOR = '#00000000';
// White seeds the color history by default (droppable as new colors are picked).
const WHITE_COLOR = '#ffffff';

function loadRecentColors(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_COLORS_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(arr)) {
      return [];
    }
    return arr
      .filter((c): c is string => typeof c === 'string' && HEX_COLOR.test(c))
      .map((c) => c.toLowerCase());
  } catch {
    return [];
  }
}

function saveRecentColors(colors: string[]): void {
  try {
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(colors));
  } catch {
    // Best-effort; storage may be unavailable.
  }
}

// Spotlight effect settings adjustable from the settings popover, each snapping
// to a few discrete stops (px). Persisted in localStorage (per-origin, so they
// survive across sessions) and validated against their stops on read, since the
// page shares that storage. All of them are per-pick: they seed the next picked
// element; already-spotlit elements keep the values they were picked with.
// Padding stops for the settings slider; 0 means no padding (off).
const PADDING_VALUES = [0, 2, 4, 6, 8, 10, 12] as const;
const THICKNESS_STOPS = [1, 2, 3, 4, 5] as const;
const RADIUS_STOPS = [0, 4, 8, 12, 16, 24] as const;
// Background dim strength (0 = none, 1 = fully black). Default 0.6 sits mid-row.
const DIM_STOPS = [0.3, 0.4, 0.5, 0.6, 0.7] as const;
// Padding the Reset button restores.
const PADDING_DEFAULT_ON = 0;

const PADDING_KEY = 'nhost-ss:padding';
const THICKNESS_KEY = 'nhost-ss:thickness';
const RADIUS_KEY = 'nhost-ss:radius';
const DIM_KEY = 'nhost-ss:dim';

// Whether the toolbar opens in select mode. Persisted so the toolbar restores
// the user's last explicit Select toggle; defaults to closed (false) when unset.
const SELECT_MODE_KEY = 'nhost-ss:select-mode';

function loadSelectMode(): boolean {
  try {
    return localStorage.getItem(SELECT_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveSelectMode(on: boolean): void {
  try {
    localStorage.setItem(SELECT_MODE_KEY, String(on));
  } catch {
    // Best-effort; storage may be unavailable.
  }
}

// Whether the toolbar is open. Stored in sessionStorage (per-tab) so a full
// page reload re-opens it where it was, without leaking the open state to other
// tabs or surviving the tab being closed.
const ACTIVE_KEY = 'nhost-ss:active';

function loadActive(): boolean {
  try {
    return sessionStorage.getItem(ACTIVE_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveActive(on: boolean): void {
  try {
    if (on) {
      sessionStorage.setItem(ACTIVE_KEY, 'true');
    } else {
      sessionStorage.removeItem(ACTIVE_KEY);
    }
  } catch {
    // Best-effort; storage may be unavailable.
  }
}

function loadSetting(key: string, min: number, max: number): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return null;
    }
    const value = Number(raw);
    return Number.isFinite(value) && value >= min && value <= max
      ? value
      : null;
  } catch {
    return null;
  }
}

function saveSetting(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Best-effort; storage may be unavailable.
  }
}

// Persist the spotlight selection (and the undo history) per-page so they
// survive reloads and round-trip navigations (click a link, then come back).
// Each picked element is stored as a robust CSS path plus the color/padding
// chosen for it, in sessionStorage (per-tab, cleared when the tab closes), and
// re-resolved on the next activation.
// Keyed by pathname so each page keeps its own spotlight set. These must be
// evaluated per call (not frozen at module load): in a single-page app the
// content script loads once but the path changes on client-side navigation.
const selectionKey = (path: string = location.pathname): string =>
  `nhost-ss:selection:${path}`;
const historyKey = (path: string = location.pathname): string =>
  `nhost-ss:history:${path}`;

// Build a reasonably stable, unique selector for an element: an id shortcut
// when one resolves uniquely, otherwise an :nth-of-type path up to <html> or
// the nearest uniquely-id'd ancestor.
function uniqueSelector(el: Element): string | null {
  if (
    el.id &&
    document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1
  ) {
    return `#${CSS.escape(el.id)}`;
  }
  const path: string[] = [];
  let node: Element | null = el;
  while (node && node !== document.documentElement) {
    const parent: Element | null = node.parentElement;
    if (!parent) {
      break;
    }
    const tag = node.localName;
    const sameTag = Array.from(parent.children).filter(
      (c) => c.localName === tag,
    );
    path.unshift(
      sameTag.length > 1
        ? `${tag}:nth-of-type(${sameTag.indexOf(node) + 1})`
        : tag,
    );
    if (
      parent.id &&
      document.querySelectorAll(`#${CSS.escape(parent.id)}`).length === 1
    ) {
      path.unshift(`#${CSS.escape(parent.id)}`);
      return path.join(' > ');
    }
    node = parent;
  }
  return path.length ? path.join(' > ') : null;
}

interface StoredSelection {
  s: string;
  c: string;
  p: number;
  w: number;
  r: number;
}

function toStored(entries: SelectionEntry[]): StoredSelection[] {
  return entries
    .map((e): StoredSelection | null => {
      const s = uniqueSelector(e.el);
      return s
        ? { s, c: e.color, p: e.padding, w: e.outlineWidth, r: e.radius }
        : null;
    })
    .filter((x): x is StoredSelection => x !== null);
}

// Resolve a parsed array of stored entries back to live elements, dropping any
// whose selector no longer parses or resolves on this page.
function resolveStored(items: unknown): SelectionEntry[] {
  if (!Array.isArray(items)) {
    return [];
  }
  const entries: SelectionEntry[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const { s, c, p, w, r } = item as Record<string, unknown>;
    if (typeof s !== 'string') {
      continue;
    }
    const color =
      typeof c === 'string' && HEX_COLOR.test(c)
        ? c.toLowerCase()
        : DEFAULT_OPTIONS.outlineColor;
    const padding =
      typeof p === 'number' && Number.isFinite(p) ? p : DEFAULT_OPTIONS.padding;
    const outlineWidth =
      typeof w === 'number' && Number.isFinite(w)
        ? w
        : DEFAULT_OPTIONS.outlineWidth;
    const radius =
      typeof r === 'number' && Number.isFinite(r) ? r : DEFAULT_OPTIONS.radius;
    try {
      const el = document.querySelector(s);
      if (el) {
        entries.push({ el, color, padding, outlineWidth, radius });
      }
    } catch {
      // Ignore selectors that no longer parse or resolve on this page.
    }
  }
  return entries;
}

function saveSelection(entries: SelectionEntry[], path?: string): void {
  try {
    const items = toStored(entries);
    if (items.length) {
      sessionStorage.setItem(selectionKey(path), JSON.stringify(items));
    } else {
      sessionStorage.removeItem(selectionKey(path));
    }
  } catch {
    // Best-effort; storage may be unavailable.
  }
}

function loadSelection(path?: string): SelectionEntry[] {
  try {
    const raw = sessionStorage.getItem(selectionKey(path));
    return resolveStored(raw ? JSON.parse(raw) : null);
  } catch {
    return [];
  }
}

// The undo history is an array of selection snapshots (oldest first), each
// stored exactly like a selection so it can be re-resolved after navigation.
function saveHistory(history: SelectionEntry[][], path?: string): void {
  try {
    if (history.length) {
      sessionStorage.setItem(
        historyKey(path),
        JSON.stringify(history.map(toStored)),
      );
    } else {
      sessionStorage.removeItem(historyKey(path));
    }
  } catch {
    // Best-effort; storage may be unavailable.
  }
}

function loadHistory(path?: string): SelectionEntry[][] {
  try {
    const raw = sessionStorage.getItem(historyKey(path));
    const snapshots: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(snapshots)) {
      return [];
    }
    return snapshots.map((snap) => resolveStored(snap));
  } catch {
    return [];
  }
}

const ICONS = {
  camera:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3"/></svg>',
  close:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
  download:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11"/></svg>',
  settings:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  expand:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
};

// Toolbar height in px. The toolbar is fixed at the top and the document is
// pushed down by exactly this much while the tool is active, so the bar sits
// above the page rather than over it.
const TOOLBAR_HEIGHT = 44;

/** Flat download name with a timestamp, e.g. `screenshot-2026-06-28-143022.png`.
 * No nested folders — downloads land directly in the browser's download dir. */
function downloadFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `screenshot-${ts}.png`;
}

// Icons are static, trusted markup. Parsing them as SVG (rather than assigning
// innerHTML) keeps the build free of any HTML-injection surface.
function svgEl(markup: string): SVGElement {
  const frag = document.createRange().createContextualFragment(markup.trim());
  return frag.firstElementChild as SVGElement;
}

function makeBtn(
  text: string,
  opts: { icon?: string; className?: string; title?: string } = {},
): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `nhost-ss-btn ${opts.className ?? ''}`.trim();
  if (opts.title) {
    el.title = opts.title;
  }
  if (opts.icon) {
    el.appendChild(svgEl(opts.icon));
  }
  const span = document.createElement('span');
  span.textContent = text;
  el.appendChild(span);
  return el;
}

function iconBtn(
  icon: string,
  className: string,
  title: string,
): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = className;
  el.title = title;
  el.appendChild(svgEl(icon));
  return el;
}

export interface Toolbar {
  toggle(): void;
  activate(): void;
  deactivate(): void;
  readonly active: boolean;
}

export function createToolbar(): Toolbar {
  const overlay = new OverlayController();
  const opts = { ...DEFAULT_OPTIONS };
  const storedColor = loadOutlineColor();
  if (storedColor) {
    opts.outlineColor = storedColor;
  }
  const storedPadding = loadSetting(PADDING_KEY, 0, 100);
  if (storedPadding !== null) {
    opts.padding = storedPadding;
  }
  const storedThickness = loadSetting(THICKNESS_KEY, 1, 100);
  if (storedThickness !== null) {
    opts.outlineWidth = storedThickness;
  }
  const storedRadius = loadSetting(RADIUS_KEY, 0, 100);
  if (storedRadius !== null) {
    opts.radius = storedRadius;
  }
  const storedDim = loadSetting(DIM_KEY, 0, 1);
  if (storedDim !== null) {
    opts.dim = storedDim;
  }
  let active = false;

  // The frame lives in its own ShadowRoot so the page's CSS can neither style
  // it nor be styled by it. The host carries the no-capture attribute, so
  // clicks on it are never treated as element picks.
  const host = document.createElement('div');
  host.dataset.nhostScreenshotFrame = '';
  host.setAttribute('data-nhost-ss-nocapture', '');
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = FRAME_STYLES;

  const frame = document.createElement('div');
  frame.className = 'nhost-ss-frame';

  // --- Selection island ---
  // The outline-color swatch sits in Select's icon slot (just left of it) but
  // is its own click target, so Select toggles picking and the swatch opens the
  // color picker. Select has no icon of its own.
  const selectBtn = makeBtn('Select', {
    className: 'nhost-ss-select',
    title: 'Toggle select mode',
  });
  // Undo: icon-only. Lives in the collapsible left group (only shown in select
  // mode), between Settings and Select. Only usable while picking.
  const undoBtn = iconBtn(ICONS.undo, 'nhost-ss-btn nhost-ss-undo', 'Undo');
  undoBtn.disabled = true;
  const clearBtn = makeBtn('Clear', {
    className: 'nhost-ss-clear',
    title: 'Clear the spotlight selection',
  });
  // Starts empty, so nothing to clear yet; syncClear re-enables on selection.
  clearBtn.disabled = true;

  // Outline color: a single swatch in the toolbar that opens a small popover
  // with two options — the current color, and a custom color picker.
  const outlineSwatch = document.createElement('span');
  outlineSwatch.className = 'nhost-ss-outline-swatch';
  {
    const t = opts.outlineColor.toLowerCase() === TRANSPARENT_COLOR;
    outlineSwatch.classList.toggle('is-transparent', t);
    // Clear the inline background when transparent so the white .is-transparent
    // rule wins; otherwise the swatch shows the dark toolbar through it.
    outlineSwatch.style.background = t ? '' : opts.outlineColor;
  }
  const outlineBtn = document.createElement('button');
  outlineBtn.type = 'button';
  outlineBtn.className = 'nhost-ss-btn nhost-ss-outline-btn';
  outlineBtn.title = 'Outline color';
  outlineBtn.appendChild(outlineSwatch);

  const colorPop = document.createElement('div');
  colorPop.className = 'nhost-ss-color-pop';

  let colorPopOpen = false;
  // Assigned when the settings popover is built below; lets the two popovers be
  // mutually exclusive (opening one closes the other).
  let closeSettingsPop: () => void = () => {};
  // Assigned with the reset button below; keeps it disabled when every setting
  // (color + history, padding, thickness, radius) is already at its default.
  let syncReset: () => void = () => {};
  const closeColorPop = () => {
    colorPopOpen = false;
    colorPop.classList.remove('is-open');
  };
  const openColorPop = () => {
    closeSettingsPop();
    const r = outlineBtn.getBoundingClientRect();
    colorPop.style.left = `${r.left}px`;
    colorPop.style.top = `${r.bottom + 8}px`;
    // Render on open so a freshly-picked color only joins the row the next time
    // the popover is opened (not while it's closing after the pick).
    renderColorPop();
    colorPopOpen = true;
    colorPop.classList.add('is-open');
  };

  // Transparent is a permanent first swatch (rendered separately), so history
  // holds only real colors. Seed it with white when empty, and make sure the
  // current (non-transparent) color is represented so its swatch shows active.
  const storedRecents = loadRecentColors().filter(
    (c) => c !== TRANSPARENT_COLOR,
  );
  let recentColors = (
    storedRecents.length ? storedRecents : [WHITE_COLOR]
  ).slice(0, MAX_RECENT_COLORS);
  {
    const cur = opts.outlineColor.toLowerCase();
    if (cur !== TRANSPARENT_COLOR && !recentColors.includes(cur)) {
      recentColors = [cur, ...recentColors].slice(0, MAX_RECENT_COLORS);
    }
  }

  const applyColor = (color: string, persist: boolean) => {
    opts.outlineColor = color;
    const isTransparent = color.toLowerCase() === TRANSPARENT_COLOR;
    outlineSwatch.classList.toggle('is-transparent', isTransparent);
    outlineSwatch.style.background = isTransparent ? '' : color;
    overlay.setOptions({ outlineColor: color });
    if (persist) {
      saveOutlineColor(color);
    }
  };

  // The custom picker (rainbow swatch) opens the browser's native color dialog.
  // 'input' previews the color live while dragging; 'change' commits it so a
  // whole drag adds a single recent entry rather than dozens.
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.className = 'nhost-ss-color-input';
  colorInput.value =
    opts.outlineColor.toLowerCase() !== TRANSPARENT_COLOR
      ? opts.outlineColor
      : (recentColors[0] ?? WHITE_COLOR);
  const customBtn = document.createElement('button');
  customBtn.type = 'button';
  customBtn.className = 'nhost-ss-swatch nhost-ss-swatch--custom';
  customBtn.title = 'Custom color';
  // The transparent input is overlaid full-size on the button (CSS inset:0), so
  // a click lands on it directly and opens the native picker. Forwarding a
  // second synthetic colorInput.click() from the button would double-activate
  // and cancel the picker in Chrome, so the button has no click handler.
  customBtn.appendChild(colorInput);

  function commitColor(color: string): void {
    const norm = color.toLowerCase();
    // Transparent is the permanent pin; it never joins the history row.
    if (norm !== TRANSPARENT_COLOR) {
      recentColors = [norm, ...recentColors.filter((c) => c !== norm)].slice(
        0,
        MAX_RECENT_COLORS,
      );
      saveRecentColors(recentColors);
    }
    applyColor(norm, true);
    syncReset();
  }
  function renderColorPop(): void {
    colorPop.replaceChildren();
    const current = opts.outlineColor.toLowerCase();
    const makeSwatch = (color: string, transparent: boolean) => {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'nhost-ss-swatch';
      if (transparent) {
        sw.classList.add('nhost-ss-swatch--transparent');
        sw.title = 'No outline';
      } else {
        sw.style.background = color;
        sw.title = color;
      }
      if (current === color) {
        sw.classList.add('is-active');
      }
      sw.addEventListener('click', () => {
        commitColor(color);
        closeColorPop();
      });
      return sw;
    };
    // Transparent always first, then the (white-seeded) color history.
    colorPop.appendChild(makeSwatch(TRANSPARENT_COLOR, true));
    for (const color of recentColors) {
      colorPop.appendChild(makeSwatch(color, false));
    }
    colorPop.append(customBtn);
  }

  colorInput.addEventListener('input', () =>
    applyColor(colorInput.value, false),
  );
  // Committing a custom color selects it and closes the popover.
  colorInput.addEventListener('change', () => {
    commitColor(colorInput.value);
    closeColorPop();
  });

  outlineBtn.addEventListener('click', () => {
    if (colorPopOpen) {
      closeColorPop();
    } else {
      openColorPop();
    }
  });

  // Padding is set entirely from the settings slider below (0 = no padding). It
  // persists and seeds the next pick; already-spotlit elements keep their own.
  const setPadding = (value: number) => {
    opts.padding = value;
    overlay.setOptions({ padding: value });
    saveSetting(PADDING_KEY, value);
    syncReset();
  };

  // --- Settings popover (gear button, between padding and Select) ---
  const settingsBtn = iconBtn(
    ICONS.settings,
    'nhost-ss-btn nhost-ss-settings-btn',
    'Settings',
  );
  const settingsPop = document.createElement('div');
  settingsPop.className = 'nhost-ss-settings-pop';

  // A labelled slider that snaps to a few discrete stops. Returns the row plus
  // a `sync` that reflects an externally-set value (e.g. padding toggled by its
  // button) back onto the slider + readout. `onChange` fires the chosen stop.
  const buildSlider = (
    label: string,
    stops: readonly number[],
    current: number,
    format: (v: number) => string,
    onChange: (v: number) => void,
    edit: { min: number; max: number; toRaw?: (n: number) => number },
  ): { row: HTMLElement; sync: (v: number) => void } => {
    const row = document.createElement('div');
    row.className = 'nhost-ss-set-row';

    const name = document.createElement('span');
    name.className = 'nhost-ss-set-label';
    name.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.className = 'nhost-ss-set-val';
    valueEl.title = 'Click to type an exact value';
    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.inputMode = 'numeric';
    valueInput.maxLength = 2;
    valueInput.className = 'nhost-ss-set-val-input';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'nhost-ss-slider';
    slider.min = '0';
    slider.max = String(stops.length - 1);
    // 'any' lets the thumb glide continuously; the value snaps to the nearest
    // stop (Math.round below), so it only changes once the thumb passes the
    // midpoint toward the next notch.
    slider.step = 'any';

    const nearestIndex = (v: number): number => {
      let idx = 0;
      for (let i = 1; i < stops.length; i++) {
        const a = stops[i];
        const b = stops[idx];
        if (
          a !== undefined &&
          b !== undefined &&
          Math.abs(a - v) < Math.abs(b - v)
        ) {
          idx = i;
        }
      }
      return idx;
    };
    // Position the thumb proportionally for an arbitrary (typed) value; pins to
    // an end when the value falls outside the discrete stop range.
    const fractionalIndex = (v: number): number => {
      const first = stops[0] ?? 0;
      const last = stops[stops.length - 1] ?? 0;
      if (v <= first) {
        return 0;
      }
      if (v >= last) {
        return stops.length - 1;
      }
      for (let i = 0; i < stops.length - 1; i++) {
        const a = stops[i];
        const b = stops[i + 1];
        if (a !== undefined && b !== undefined && b !== a && v >= a && v <= b) {
          return i + (v - a) / (b - a);
        }
      }
      return stops.length - 1;
    };
    let lastIdx = nearestIndex(current);
    const sync = (v: number): void => {
      const idx = nearestIndex(v);
      lastIdx = idx;
      slider.value = String(idx);
      valueEl.textContent = format(stops[idx] ?? v);
    };
    sync(current);

    slider.addEventListener('input', () => {
      const idx = Math.round(Number(slider.value));
      const value = stops[idx] ?? stops[0] ?? 0;
      valueEl.textContent = format(value);
      if (idx !== lastIdx) {
        lastIdx = idx;
        onChange(value);
      }
    });
    // Snap the thumb to its notch once the drag ends, so it never rests between
    // stops while keeping the drag itself smooth.
    slider.addEventListener('change', () => {
      slider.value = String(lastIdx);
    });

    // The readout doubles as an exact-value editor: click to type a number
    // (clamped to [min, max]). The thumb glides to roughly the matching spot,
    // but the next slider touch snaps back to the discrete stops.
    const toRaw = edit.toRaw ?? ((n: number): number => n);
    const openEditor = (): void => {
      valueInput.value = valueEl.textContent ?? '';
      valueEl.style.display = 'none';
      valueInput.style.display = 'inline-block';
      valueInput.focus();
      valueInput.select();
    };
    const closeEditor = (): void => {
      valueInput.style.display = 'none';
      valueEl.style.display = '';
    };
    const commitEditor = (): void => {
      const typed = Number(valueInput.value);
      if (Number.isFinite(typed) && valueInput.value.trim() !== '') {
        const clamped = Math.min(edit.max, Math.max(edit.min, typed));
        const raw = toRaw(clamped);
        valueEl.textContent = format(raw);
        slider.value = String(fractionalIndex(raw));
        // Force the next slider input to register as a change so dragging
        // re-snaps to a discrete stop value.
        lastIdx = -1;
        onChange(raw);
      }
      closeEditor();
    };
    valueEl.addEventListener('click', openEditor);
    // Digits only, at most two — strip anything else as it is typed/pasted.
    valueInput.addEventListener('input', () => {
      const digits = valueInput.value.replace(/[^0-9]/g, '').slice(0, 2);
      if (digits !== valueInput.value) {
        valueInput.value = digits;
      }
    });
    valueInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEditor();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeEditor();
      }
    });
    valueInput.addEventListener('blur', commitEditor);

    row.append(name, slider, valueEl, valueInput);
    return { row, sync };
  };

  const plain = (v: number): string => String(v);
  const padSlider = buildSlider(
    'Padding',
    PADDING_VALUES,
    opts.padding,
    plain,
    setPadding,
    { min: 0, max: 100 },
  );

  const thicknessSlider = buildSlider(
    'Line thickness',
    THICKNESS_STOPS,
    opts.outlineWidth,
    plain,
    (value) => {
      opts.outlineWidth = value;
      overlay.setOptions({ outlineWidth: value });
      saveSetting(THICKNESS_KEY, value);
      syncReset();
    },
    { min: 1, max: 100 },
  );

  const radiusSlider = buildSlider(
    'Border radius',
    RADIUS_STOPS,
    opts.radius,
    plain,
    (value) => {
      opts.radius = value;
      overlay.setOptions({ radius: value });
      saveSetting(RADIUS_KEY, value);
      syncReset();
    },
    { min: 0, max: 100 },
  );

  const dimLevel = (v: number): string => String(Math.round(v * 100));
  const dimSlider = buildSlider(
    'Background dim',
    DIM_STOPS,
    opts.dim,
    dimLevel,
    (value) => {
      opts.dim = value;
      overlay.setOptions({ dim: value });
      saveSetting(DIM_KEY, value);
      syncReset();
    },
    { min: 0, max: 100, toRaw: (n: number): number => n / 100 },
  );

  // The toggle shortcut is a browser-global command (manifest `commands`,
  // handled in the background worker) so it works on every tab. Binding lives
  // at chrome://extensions/shortcuts, opened via the footer link below.
  const resetBtn = makeBtn('Reset', {
    className: 'nhost-ss-set-reset',
    title: 'Restore all settings to their defaults',
  });
  // Disabled only when every setting already matches its default: color
  // (white, history just the white seed), padding (on at the default
  // amount), thickness, and radius.
  syncReset = () => {
    const colorDefault =
      opts.outlineColor.toLowerCase() === WHITE_COLOR &&
      recentColors.length === 1 &&
      recentColors[0] === WHITE_COLOR;
    const settingsDefault =
      opts.padding === PADDING_DEFAULT_ON &&
      opts.outlineWidth === DEFAULT_OPTIONS.outlineWidth &&
      opts.radius === DEFAULT_OPTIONS.radius &&
      opts.dim === DEFAULT_OPTIONS.dim;
    resetBtn.disabled = colorDefault && settingsDefault;
  };
  resetBtn.addEventListener('click', () => {
    // Color + history: white current, history reset to the white seed.
    recentColors = [WHITE_COLOR];
    saveRecentColors(recentColors);
    applyColor(WHITE_COLOR, true);
    renderColorPop();
    // Padding.
    setPadding(PADDING_DEFAULT_ON);
    padSlider.sync(PADDING_DEFAULT_ON);
    // Line thickness.
    opts.outlineWidth = DEFAULT_OPTIONS.outlineWidth;
    overlay.setOptions({ outlineWidth: DEFAULT_OPTIONS.outlineWidth });
    saveSetting(THICKNESS_KEY, DEFAULT_OPTIONS.outlineWidth);
    thicknessSlider.sync(DEFAULT_OPTIONS.outlineWidth);
    // Border radius.
    opts.radius = DEFAULT_OPTIONS.radius;
    overlay.setOptions({ radius: DEFAULT_OPTIONS.radius });
    saveSetting(RADIUS_KEY, DEFAULT_OPTIONS.radius);
    radiusSlider.sync(DEFAULT_OPTIONS.radius);
    // Background dim.
    opts.dim = DEFAULT_OPTIONS.dim;
    overlay.setOptions({ dim: DEFAULT_OPTIONS.dim });
    saveSetting(DIM_KEY, DEFAULT_OPTIONS.dim);
    dimSlider.sync(DEFAULT_OPTIONS.dim);
    syncReset();
  });
  syncReset();

  // Footer: "Hotkey setup" on the left, Reset all on the right (one row).
  const footerRow = document.createElement('div');
  footerRow.className = 'nhost-ss-set-row nhost-ss-set-footer';
  const hotkeyBtn = makeBtn('Hotkey', {
    className: 'nhost-ss-set-reset',
  });
  hotkeyBtn.addEventListener('click', () => requestOpenShortcuts());
  footerRow.append(hotkeyBtn, resetBtn);

  settingsPop.append(
    padSlider.row,
    thicknessSlider.row,
    radiusSlider.row,
    dimSlider.row,
    footerRow,
  );

  let settingsPopOpen = false;
  closeSettingsPop = () => {
    settingsPopOpen = false;
    settingsPop.classList.remove('is-open');
  };
  const openSettingsPop = () => {
    closeColorPop();
    const r = settingsBtn.getBoundingClientRect();
    settingsPop.style.left = `${r.left}px`;
    settingsPop.style.top = `${r.bottom + 8}px`;
    settingsPopOpen = true;
    settingsPop.classList.add('is-open');
  };
  settingsBtn.addEventListener('click', () => {
    if (settingsPopOpen) {
      closeSettingsPop();
    } else {
      openSettingsPop();
    }
  });

  // --- Capture / close ---
  const captureBtn = iconBtn(
    ICONS.camera,
    'nhost-ss-btn nhost-ss-capture',
    'Capture screenshot',
  );
  const closeBtn = iconBtn(
    ICONS.close,
    'nhost-ss-close nhost-ss-close--pinned',
    'Close screenshot tool',
  );

  // Layout: the frame is a 3-column grid (1fr / auto / 1fr) so Select (the
  // center column) is always screen-centered regardless of the side widths. The
  // left group (swatch, padding, settings, undo) and Select + Clear together
  // read as one pill. The left group collapses to zero width when not picking
  // and slides open when select mode is toggled on; Select never moves. The
  // close button is pinned to the right edge. There is no dim button — dimming
  // is automatic (see below).
  const leftGroup = document.createElement('div');
  leftGroup.className = 'nhost-ss-leftgroup';
  leftGroup.append(undoBtn, outlineBtn, settingsBtn);

  const rightGroup = document.createElement('div');
  rightGroup.className = 'nhost-ss-rightgroup';
  rightGroup.append(clearBtn, captureBtn);

  frame.append(
    leftGroup,
    selectBtn,
    rightGroup,
    closeBtn,
    colorPop,
    settingsPop,
  );

  // --- Save modal (built once, shown by appending the backdrop) ---
  const backdrop = document.createElement('div');
  backdrop.className = 'nhost-ss-backdrop';
  const modal = document.createElement('div');
  modal.className = 'nhost-ss-modal';

  const modalHead = document.createElement('div');
  modalHead.className = 'nhost-ss-modal-head';
  const modalTitle = document.createElement('div');
  modalTitle.className = 'nhost-ss-modal-title';
  modalTitle.textContent = 'Save screenshot';
  const modalClose = iconBtn(ICONS.close, 'nhost-ss-close', 'Close');
  modalHead.append(modalTitle, modalClose);

  // The preview sits in a wrapper so the full-screen expand button can overlay
  // it without being wiped by the spinner<->image swaps below.
  const previewWrap = document.createElement('div');
  previewWrap.className = 'nhost-ss-preview-wrap';
  const preview = document.createElement('div');
  preview.className = 'nhost-ss-preview';
  const previewImg = document.createElement('img');
  previewImg.alt = 'Screenshot preview';
  const spinner = document.createElement('div');
  spinner.className = 'nhost-ss-spinner';
  const expandBtn = iconBtn(ICONS.expand, 'nhost-ss-expand', 'Full screen');
  previewWrap.append(preview, expandBtn);

  // Full-screen preview overlay (appended to the shadow on demand, above the
  // modal). Click anywhere or press Esc to dismiss.
  const fsOverlay = document.createElement('div');
  fsOverlay.className = 'nhost-ss-fs';
  const fsImg = document.createElement('img');
  fsImg.alt = 'Screenshot full view';
  fsOverlay.appendChild(fsImg);

  // Controls row above the preview: filename field, then Save as / download /
  // copy. "Save as" opens the browser's native save dialog (pick any location);
  // download/copy are icon-only.
  const controls = document.createElement('div');
  controls.className = 'nhost-ss-controls';

  const field = document.createElement('div');
  field.className = 'nhost-ss-field';
  const filename = document.createElement('input');
  filename.type = 'text';
  filename.spellcheck = false;
  filename.placeholder = 'Filename';
  // Clicking the field selects the whole name for easy retyping. focus selects;
  // the click's mouseup would otherwise collapse it, so reselect on a plain
  // click while still respecting a deliberate drag-selection.
  filename.addEventListener('focus', () => filename.select());
  filename.addEventListener('mouseup', (event) => {
    if (filename.selectionStart === filename.selectionEnd) {
      event.preventDefault();
      filename.select();
    }
  });
  field.append(filename);

  const saveAsBtn = makeBtn('Save as', { className: 'is-primary' });
  const downloadBtn = iconBtn(ICONS.download, 'nhost-ss-actbtn', 'Download');
  const copyBtn = iconBtn(ICONS.copy, 'nhost-ss-actbtn', 'Copy');
  controls.append(field, saveAsBtn, downloadBtn, copyBtn);

  const status = document.createElement('div');
  status.className = 'nhost-ss-status';

  modal.append(modalHead, controls, previewWrap, status);
  backdrop.appendChild(modal);

  shadow.append(style, frame);

  // --- State + helpers ---
  let capturedDataUrl: string | null = null;

  // Push the page down so the toolbar sits above the content instead of over
  // it. We restore whatever inline padding-top the page had on the way out.
  const docEl = document.documentElement;
  let savedPaddingTop: string | null = null;
  const pushPage = () => {
    if (savedPaddingTop === null) {
      savedPaddingTop = docEl.style.paddingTop;
    }
    docEl.style.setProperty('padding-top', `${TOOLBAR_HEIGHT}px`, 'important');
  };
  const restorePage = () => {
    if (savedPaddingTop === null) {
      return;
    }
    if (savedPaddingTop) {
      docEl.style.setProperty('padding-top', savedPaddingTop);
    } else {
      docEl.style.removeProperty('padding-top');
    }
    savedPaddingTop = null;
  };

  const setStatus = (message: string, kind: '' | 'ok' | 'err' = '') => {
    status.textContent = message;
    status.className = `nhost-ss-status${kind ? ` is-${kind}` : ''}`;
  };

  const closeFs = () => {
    fsOverlay.classList.remove('is-open');
    fsOverlay.remove();
  };
  const openFs = () => {
    if (!capturedDataUrl) {
      return;
    }
    fsImg.src = capturedDataUrl;
    shadow.appendChild(fsOverlay);
    fsOverlay.classList.add('is-open');
  };
  const onModalKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      // Step out of full-screen first; only then close the whole modal.
      if (fsOverlay.isConnected) {
        closeFs();
        return;
      }
      closeModal();
    }
  };
  const closeModal = () => {
    document.removeEventListener('keydown', onModalKeydown, true);
    closeFs();
    backdrop.remove();
  };

  const openModal = () => {
    setStatus('');
    filename.value = downloadFilename();
    capturedDataUrl = null;
    expandBtn.style.display = 'none';
    preview.replaceChildren(spinner);
    shadow.appendChild(backdrop);
    document.addEventListener('keydown', onModalKeydown, true);

    void (async () => {
      // Hide our own chrome so it is not baked into the flat capture, drop the
      // push-down so the real page (not a blank strip) is captured, then
      // re-render the spotlight against the reflowed layout before grabbing the
      // live viewport pixels.
      overlay.prepareForCapture();
      frame.style.visibility = 'hidden';
      backdrop.style.visibility = 'hidden';
      docEl.style.removeProperty('padding-top');
      overlay.setOptions({ topInset: 0 });
      overlay.refresh();
      try {
        await nextRepaint();
        const dataUrl = await requestCapture();
        capturedDataUrl = dataUrl;
        previewImg.src = dataUrl;
        preview.replaceChildren(previewImg);
        expandBtn.style.display = '';
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        preview.replaceChildren();
        setStatus(message, 'err');
      } finally {
        frame.style.visibility = '';
        backdrop.style.visibility = '';
        // Always clear the capture flag so transparent guides reappear, even
        // when the overlay was deactivated mid-capture.
        overlay.endCapture();
        if (active) {
          pushPage();
          overlay.setOptions({ topInset: TOOLBAR_HEIGHT });
          overlay.refresh();
        }
      }
    })();
  };

  // --- Wiring: toolbar ---
  // Dim is automatic: the page dims whenever the spotlight is in use — while
  // picking, or whenever at least one element is selected. Keeping it on for a
  // non-empty selection (not just while picking) means the dim survives the
  // capture, where picking is stopped right before the screenshot is taken.
  const syncAutoDim = () => {
    const on = overlay.isPicking || overlay.selectionCount > 0;
    opts.dimEnabled = on;
    overlay.setOptions({ dimEnabled: on });
  };

  // Undo is only usable while picking (select mode) and only when there is a
  // prior selection state to step back to. A Clear still records a state, so it
  // can be undone once back in select mode.
  const syncUndo = () => {
    undoBtn.disabled = !(overlay.isPicking && overlay.canUndo);
  };

  // Clear is only meaningful when something is selected.
  const syncClear = () => {
    clearBtn.disabled = overlay.selectionCount === 0;
  };

  // Don't persist the selection wipe that overlay.deactivate() triggers when
  // the tool is closed — we want picks remembered for the next activation.
  let suppressSelectionSave = false;

  overlay.onPickingChange = (picking) => {
    selectBtn.classList.toggle('is-active', picking);
    // Slide the left group (swatch, padding, settings, undo) open while picking
    // and collapse it otherwise.
    frame.classList.toggle('is-picking', picking);
    syncAutoDim();
    syncUndo();
  };
  overlay.onSelectionChange = () => {
    if (!suppressSelectionSave) {
      saveSelection(overlay.getSelection());
      saveHistory(overlay.getHistory());
    }
    syncAutoDim();
    syncUndo();
    syncClear();
  };

  const toggleSelect = () => {
    overlay.togglePicking();
    saveSelectMode(overlay.isPicking);
  };
  selectBtn.addEventListener('click', toggleSelect);
  undoBtn.addEventListener('click', () => overlay.undo());
  clearBtn.addEventListener('click', () => overlay.clearSelection());

  // Dismiss the color popover when clicking elsewhere in the toolbar.
  shadow.addEventListener('click', (event) => {
    const target = event.target as Node;
    if (
      colorPopOpen &&
      !colorPop.contains(target) &&
      !outlineBtn.contains(target)
    ) {
      closeColorPop();
    }
    if (
      settingsPopOpen &&
      !settingsPop.contains(target) &&
      !settingsBtn.contains(target)
    ) {
      closeSettingsPop();
    }
  });

  captureBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', () => deactivate());

  // Clicking anywhere outside the toolbar (on the page) dismisses the color
  // popover. Clicks inside the toolbar retarget to the shadow host, so they are
  // recognised as "inside" and handled by the in-toolbar dismiss logic above.
  const handleOutsideClick = (event: MouseEvent) => {
    if (!host.contains(event.target as Node)) {
      closeColorPop();
      closeSettingsPop();
    }
  };

  // Escape closes the popovers (in addition to exiting select mode, which the
  // overlay handles). Registered while the toolbar is active.
  const handleEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      // Esc exits select mode (the overlay stops picking); persist regular mode
      // so reopening the toolbar doesn't restore select mode.
      saveSelectMode(false);
      closeColorPop();
      closeSettingsPop();
    }
  };

  // --- Wiring: modal ---
  modalClose.addEventListener('click', closeModal);
  // Only dismiss when the press both starts and ends on the backdrop itself. A
  // text selection that begins inside the modal (e.g. on the filename) and
  // drags onto the backdrop must not close it.
  let pressedOnBackdrop = false;
  backdrop.addEventListener('mousedown', (event) => {
    pressedOnBackdrop = event.target === backdrop;
  });
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop && pressedOnBackdrop) {
      closeModal();
    }
    pressedOnBackdrop = false;
  });
  expandBtn.addEventListener('click', openFs);
  fsOverlay.addEventListener('click', closeFs);
  saveAsBtn.addEventListener('click', () => {
    if (!capturedDataUrl) {
      return;
    }
    // saveAs: true makes the browser open its native "Save As" dialog, so the
    // user picks the location and confirms the filename. Close on success.
    void requestDownload(capturedDataUrl, filename.value, true)
      .then(() => closeModal())
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`Save failed: ${message}`, 'err');
      });
  });
  downloadBtn.addEventListener('click', () => {
    if (!capturedDataUrl) {
      return;
    }
    void requestDownload(capturedDataUrl, filename.value)
      .then(() => closeModal())
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(message, 'err');
      });
  });
  copyBtn.addEventListener('click', () => {
    if (!capturedDataUrl) {
      return;
    }
    void copyBlobToClipboard(dataUrlToBlob(capturedDataUrl))
      .then(() => setStatus('Copied to clipboard.', 'ok'))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(message, 'err');
      });
  });

  // Spotlight selections are per-page. In a single-page app, client-side
  // navigation changes location.pathname without a reload, so the in-memory
  // picks would otherwise bleed onto the next page. We watch the path and swap
  // to the destination page's saved set (empty → clears the overlay). Content
  // scripts run in an isolated world where the page's history.pushState can't
  // be patched, so we poll the path and also catch back/forward via popstate.
  let currentPath = location.pathname;
  let navPollId = 0;
  const handleNavigation = () => {
    if (!active || location.pathname === currentPath) {
      return;
    }
    currentPath = location.pathname;
    // The outgoing page's picks were already persisted on every change, so we
    // only need to load the destination's; restoreSelection clears the overlay
    // when this page has none.
    overlay.restoreSelection(
      loadSelection(currentPath),
      loadHistory(currentPath),
    );
  };

  function activate(): void {
    if (active) {
      return;
    }
    active = true;
    saveActive(true);

    document.documentElement.appendChild(host);
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleEscape, true);
    currentPath = location.pathname;
    window.addEventListener('popstate', handleNavigation);
    navPollId = window.setInterval(handleNavigation, 300);
    pushPage();
    opts.topInset = TOOLBAR_HEIGHT;
    overlay.activate();
    overlay.setOptions(opts);

    // Restore any spotlight selection persisted for this page (after a reload
    // or a round-trip navigation). This re-triggers auto-dim via the
    // selection-change handler.
    const restored = loadSelection();
    const restoredHistory = loadHistory();
    if (restored.length || restoredHistory.length) {
      overlay.restoreSelection(restored, restoredHistory);
    }

    // Restore the last explicit select-mode state (defaults to open).
    if (loadSelectMode()) {
      overlay.startPicking();
    }
  }

  function deactivate(): void {
    if (!active) {
      return;
    }
    active = false;
    saveActive(false);
    closeModal();
    closeColorPop();
    closeSettingsPop();
    document.removeEventListener('click', handleOutsideClick);
    document.removeEventListener('keydown', handleEscape, true);
    window.removeEventListener('popstate', handleNavigation);
    if (navPollId) {
      window.clearInterval(navPollId);
      navPollId = 0;
    }
    host.remove();
    suppressSelectionSave = true;
    overlay.deactivate();
    suppressSelectionSave = false;
    restorePage();
  }

  // Re-open automatically after a full page reload if the tab had it open. The
  // declarative content script re-runs on every load, so this restores the
  // toolbar without the user pressing the shortcut again.
  if (loadActive()) {
    activate();
  }

  return {
    toggle: () => (active ? deactivate() : activate()),
    activate,
    deactivate,
    get active() {
      return active;
    },
  };
}
