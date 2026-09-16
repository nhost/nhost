'use client';

import {
  EyeOff,
  LayoutDashboard,
  Mail,
  Moon,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import { HasuraLogo } from './HasuraLogo';
import { NhostLogo } from './NhostLogo';
import { clamp, nearestEdge } from './snap';
import { Trapezoid } from './Trapezoid';
import {
  type Edge,
  localServiceUrls,
  type Theme,
  useToolbarSettings,
} from './useToolbarSettings';

const DRAG_THRESHOLD = 6;
const NARROW = 32; // the thin (cross-edge) dimension of the tab
const ICON = 24; // icon button hit area
const GAP = 2; // gap between icon buttons, kept tiny for continuous hover
const PAD = 18; // padding at the two ends of the strip
const COLLAPSED = PAD * 2 + ICON; // shows only the Nhost handle
const EXPANDED = PAD * 2 + 5 * ICON + 4 * GAP; // handle + four actions
const SPRING_TAU = 0.085; // position smoothing time constant, seconds
const SIZE_TAU = 0.055; // expand/collapse smoothing, a touch quicker

function isVertical(edge: Edge) {
  return edge === 'left' || edge === 'right';
}

// Resting position of the tab's centre, in viewport pixels, so the connected
// side stays flush against its edge and centred on `offset`.
function restingCenter(edge: Edge, offset: number, vw: number, vh: number) {
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

const VIEWPORT_MARGIN = 8;

// The tab grows from the handle toward one far end: down on a vertical edge,
// right on a horizontal one. These are the distances from the handle anchor to
// the tab's near end (where the handle sits) and to its far end once expanded.
const ANCHOR_NEAR = COLLAPSED / 2;
const ANCHOR_FAR = EXPANDED - COLLAPSED / 2;

// Clamp the handle anchor along the growth axis so both the near end and the
// *expanded* far end clear the viewport by VIEWPORT_MARGIN. Reserving the
// expanded length regardless of open state is what keeps the handle still:
// there is always room to grow, so opening the menu never nudges it inward.
function clampAnchor(
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
function growthOffset(edge: Edge, size: number) {
  const shift = (size - COLLAPSED) / 2;
  return isVertical(edge) ? { dx: 0, dy: shift } : { dx: shift, dy: 0 };
}

// Position for the single shared tooltip, aligned with the hovered item at
// strip position `pos` (0 is the handle, 1..4 the actions).
function tooltipStyle(edge: Edge, pos: number): CSSProperties {
  const center = PAD + pos * (ICON + GAP) + ICON / 2;
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

function cardAnchor(edge: Edge): CSSProperties {
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

function palette(theme: Theme) {
  return theme === 'light'
    ? { from: '#ffffff', to: '#e8edf4' }
    : { from: '#262a31', to: '#0b0d10' };
}

export function NhostDevToolbar() {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  return <Toolbar />;
}

function Toolbar() {
  const { ready, settings, update, hidden, setHidden } = useToolbarSettings();
  const [open, setOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<{ label: string; pos: number } | null>(
    null,
  );
  const lastHover = useRef({ label: '', pos: 1 });

  // Spring animation state: `cur` is what we render, eased toward the targets.
  const [, force] = useReducer((n: number) => n + 1, 0);
  const cur = useRef({ cx: 0, cy: 0, size: COLLAPSED });
  const posTarget = useRef({ cx: 0, cy: 0 });
  const sizeTarget = useRef(COLLAPSED);
  const raf = useRef(0);
  const inited = useRef(false);
  const prefsRef = useRef(prefsOpen);
  prefsRef.current = prefsOpen;

  const animate = useCallback(() => {
    if (raf.current) {
      return;
    }
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const c = cur.current;
      const kPos = 1 - Math.exp(-dt / SPRING_TAU);
      const kSize = 1 - Math.exp(-dt / SIZE_TAU);
      c.cx += (posTarget.current.cx - c.cx) * kPos;
      c.cy += (posTarget.current.cy - c.cy) * kPos;
      c.size += (sizeTarget.current - c.size) * kSize;
      const settled =
        Math.abs(posTarget.current.cx - c.cx) < 0.3 &&
        Math.abs(posTarget.current.cy - c.cy) < 0.3 &&
        Math.abs(sizeTarget.current - c.size) < 0.3;
      if (settled) {
        c.cx = posTarget.current.cx;
        c.cy = posTarget.current.cy;
        c.size = sizeTarget.current;
        raf.current = 0;
        force();
        return;
      }
      force();
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    const measure = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(
    () => () => {
      if (raf.current) {
        cancelAnimationFrame(raf.current);
      }
    },
    [],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPrefsOpen(false);
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Drive the size and, unless dragging, the docked position toward their rest.
  useEffect(() => {
    if (viewport.w === 0) {
      return;
    }
    const rest = restingCenter(
      settings.edge,
      settings.offset,
      viewport.w,
      viewport.h,
    );
    const anchor = clampAnchor(
      settings.edge,
      rest.cx,
      rest.cy,
      viewport.w,
      viewport.h,
    );
    sizeTarget.current = open ? EXPANDED : COLLAPSED;
    if (!dragging) {
      posTarget.current = anchor;
    }
    if (!inited.current) {
      inited.current = true;
      cur.current = { cx: anchor.cx, cy: anchor.cy, size: COLLAPSED };
      force();
      return;
    }
    animate();
  }, [
    open,
    dragging,
    settings.edge,
    settings.offset,
    viewport.w,
    viewport.h,
    animate,
  ]);

  // Drag detection lives on the whole tab. Anywhere you press can start a drag;
  // a press that never crosses the threshold is left to fire its normal click
  // (toggle the menu, open a link), while a real drag repositions the tab and
  // its trailing click is swallowed so it does not also activate a button.
  const justDragged = useRef(false);
  const onDragStart = useCallback(
    (event: ReactPointerEvent) => {
      const start = { x: event.clientX, y: event.clientY };
      let moved = false;

      const move = (ev: PointerEvent) => {
        if (
          !moved &&
          Math.hypot(ev.clientX - start.x, ev.clientY - start.y) >
            DRAG_THRESHOLD
        ) {
          moved = true;
          setDragging(true);
          setOpen(false);
          setPrefsOpen(false);
        }
        if (moved) {
          posTarget.current = { cx: ev.clientX, cy: ev.clientY };
          animate();
        }
      };

      const up = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        if (moved) {
          update(
            nearestEdge(
              ev.clientX,
              ev.clientY,
              window.innerWidth,
              window.innerHeight,
            ),
          );
          setDragging(false);
          justDragged.current = true;
          window.setTimeout(() => {
            justDragged.current = false;
          }, 150);
        }
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    },
    [update, animate],
  );

  const swallowDraggedClick = useCallback((event: ReactMouseEvent) => {
    if (justDragged.current) {
      event.preventDefault();
      event.stopPropagation();
      justDragged.current = false;
    }
  }, []);

  const toggleMenu = useCallback(() => {
    if (prefsRef.current) {
      setPrefsOpen(false);
    } else {
      setOpen((value) => !value);
    }
  }, []);

  if (!ready || hidden || viewport.w === 0) {
    return null;
  }

  const vertical = isVertical(settings.edge);
  const urls = localServiceUrls();
  const { cx, cy, size } = cur.current;
  const growth = growthOffset(settings.edge, size);
  const shellW = vertical ? NARROW : size;
  const shellH = vertical ? size : NARROW;
  const colors = palette(settings.theme);

  const rootStyle: CSSProperties = {
    position: 'fixed',
    left: cx + growth.dx,
    top: cy + growth.dy,
    translate: '-50% -50%',
    width: shellW,
    height: shellH,
  };

  const services = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      href: urls.dashboard,
      icon: <LayoutDashboard size={13} />,
    },
    {
      key: 'hasura',
      label: 'Hasura',
      href: urls.hasura,
      icon: <HasuraLogo width={13} height={13} />,
    },
    {
      key: 'mailhog',
      label: 'Mailhog',
      href: urls.mailhog,
      icon: <Mail size={13} />,
    },
  ];
  const tabIndex = open ? 0 : -1;
  if (hover) {
    lastHover.current = hover;
  }
  const tooltipShown = hover !== null && open && !prefsOpen;
  const onEnter = (label: string, pos: number) => setHover({ label, pos });

  return (
    <div
      className="ndt-root"
      data-theme={settings.theme}
      data-edge={settings.edge}
      data-dragging={dragging}
      data-prefs={prefsOpen}
      style={rootStyle}
    >
      <style>{TOOLBAR_CSS}</style>

      <Trapezoid
        edge={settings.edge}
        w={shellW}
        h={shellH}
        from={colors.from}
        to={colors.to}
      />

      <div
        className="ndt-strip"
        data-open={open}
        onPointerDown={onDragStart}
        onClickCapture={swallowDraggedClick}
        onPointerLeave={() => setHover(null)}
      >
        <button
          type="button"
          className="ndt-handle"
          aria-label="Nhost dev tools"
          aria-expanded={open}
          onClick={toggleMenu}
        >
          <NhostLogo width={14} height={15} />
        </button>

        {services.map((service, index) => (
          <a
            key={service.key}
            className="ndt-item"
            href={service.href}
            target="_blank"
            rel="noreferrer"
            tabIndex={tabIndex}
            onPointerEnter={() => onEnter(service.label, index + 1)}
            style={{ transitionDelay: `${open ? index * 45 : 0}ms` }}
          >
            {service.icon}
          </a>
        ))}

        <button
          type="button"
          className="ndt-item"
          tabIndex={tabIndex}
          onClick={() => setPrefsOpen((value) => !value)}
          onPointerEnter={() => onEnter('Preferences', services.length + 1)}
          style={{ transitionDelay: `${open ? services.length * 45 : 0}ms` }}
        >
          <Settings size={13} />
        </button>
      </div>

      <div
        className="ndt-tooltip"
        data-show={tooltipShown}
        style={tooltipStyle(settings.edge, lastHover.current.pos)}
      >
        {lastHover.current.label}
      </div>

      <Preferences
        open={prefsOpen}
        anchor={cardAnchor(settings.edge)}
        settings={settings}
        update={update}
        onClose={() => setPrefsOpen(false)}
        onHide={() => {
          setPrefsOpen(false);
          setOpen(false);
          setHidden(true);
        }}
      />
    </div>
  );
}

interface PreferencesProps {
  open: boolean;
  anchor: CSSProperties;
  settings: ReturnType<typeof useToolbarSettings>['settings'];
  update: ReturnType<typeof useToolbarSettings>['update'];
  onClose: () => void;
  onHide: () => void;
}

function Preferences({
  open,
  anchor,
  settings,
  update,
  onClose,
  onHide,
}: PreferencesProps) {
  const edges: Array<{ value: Edge; label: string }> = [
    { value: 'left', label: 'Left' },
    { value: 'top', label: 'Top' },
    { value: 'bottom', label: 'Bottom' },
    { value: 'right', label: 'Right' },
  ];
  const themes: Array<{ value: Theme; label: string; Icon: typeof Sun }> = [
    { value: 'dark', label: 'Dark', Icon: Moon },
    { value: 'light', label: 'Light', Icon: Sun },
  ];

  return (
    <div
      className="ndt-card"
      data-open={open}
      style={anchor}
      aria-hidden={!open}
    >
      <div className="ndt-card-head">
        <span className="ndt-card-title">Preferences</span>
        <button
          type="button"
          className="ndt-icon-btn"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      <div className="ndt-field">
        <span className="ndt-field-label">Position</span>
        <div className="ndt-segment">
          {edges.map((item) => (
            <button
              key={item.value}
              type="button"
              data-active={settings.edge === item.value}
              onClick={() => update({ edge: item.value })}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ndt-field">
        <span className="ndt-field-label">Theme</span>
        <div className="ndt-segment">
          {themes.map((item) => (
            <button
              key={item.value}
              type="button"
              data-active={settings.theme === item.value}
              onClick={() => update({ theme: item.value })}
            >
              <item.Icon size={14} />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="ndt-hide-btn" onClick={onHide}>
        <EyeOff size={15} />
        Hide for this session
      </button>

      <p className="ndt-note">
        Dev only. To remove, delete <code>src/components/dev-toolbar/</code>.
      </p>
    </div>
  );
}

const TOOLBAR_CSS = `
.ndt-root {
  --ndt-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ndt-ink: #f5f5f7;
  --ndt-accent: #4c9bff;
  --ndt-surface: rgba(22, 24, 28, 0.94);
  --ndt-text: #f5f5f7;
  --ndt-muted: rgba(245, 245, 247, 0.6);
  --ndt-border: rgba(255, 255, 255, 0.12);
  --ndt-menu-hover: rgba(255, 255, 255, 0.08);
  z-index: 2147483000;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  font-size: 13px;
  line-height: 1;
  color: var(--ndt-ink);
}
.ndt-root[data-theme='light'] {
  --ndt-ink: #16181c;
  --ndt-accent: #0060df;
  --ndt-surface: rgba(255, 255, 255, 0.95);
  --ndt-text: #16181c;
  --ndt-muted: rgba(22, 24, 28, 0.55);
  --ndt-border: rgba(0, 0, 0, 0.1);
  --ndt-menu-hover: rgba(0, 0, 0, 0.05);
}

.ndt-strip {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: ${GAP}px;
  cursor: grab;
  touch-action: none;
}
.ndt-root[data-dragging='true'] .ndt-strip {
  cursor: grabbing;
}
.ndt-root[data-edge='left'] .ndt-strip,
.ndt-root[data-edge='right'] .ndt-strip {
  flex-direction: column;
  padding: ${PAD}px 0;
}
.ndt-root[data-edge='top'] .ndt-strip,
.ndt-root[data-edge='bottom'] .ndt-strip {
  flex-direction: row;
  padding: 0 ${PAD}px;
}

.ndt-handle {
  display: grid;
  place-items: center;
  width: ${ICON}px;
  height: ${ICON}px;
  flex-shrink: 0;
  padding: 0;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--ndt-ink);
  cursor: pointer;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
}
.ndt-root[data-dragging='true'] .ndt-handle,
.ndt-root[data-dragging='true'] .ndt-item {
  cursor: grabbing;
}
.ndt-handle:focus-visible {
  outline: 2px solid var(--ndt-accent);
  outline-offset: 2px;
}

.ndt-item {
  position: relative;
  display: grid;
  place-items: center;
  width: ${ICON}px;
  height: ${ICON}px;
  flex-shrink: 0;
  padding: 0;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--ndt-ink);
  cursor: pointer;
  text-decoration: none;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.3s ease,
    color 0.2s ease-in-out;
}
.ndt-strip[data-open='true'] .ndt-item {
  opacity: 1;
  pointer-events: auto;
}
.ndt-item:hover {
  color: var(--ndt-accent);
}
.ndt-item:focus-visible {
  outline: 2px solid var(--ndt-accent);
  outline-offset: 2px;
}

/* A single shared tooltip that slides between items instead of one per item. */
.ndt-tooltip {
  position: absolute;
  padding: 5px 9px;
  border-radius: 8px;
  background: var(--ndt-surface);
  color: var(--ndt-text);
  border: 1px solid var(--ndt-border);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
  transition:
    opacity 0.2s ease-in-out,
    top 0.2s ease-in-out,
    left 0.2s ease-in-out;
}
.ndt-tooltip[data-show='true'] {
  opacity: 1;
}

.ndt-card {
  position: absolute;
  width: 268px;
  max-height: min(80vh, 460px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--ndt-border);
  border-radius: 16px;
  background: var(--ndt-surface);
  backdrop-filter: blur(16px);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.4);
  opacity: 0;
  transform: scale(0.9);
  transition:
    transform 0.42s var(--ndt-spring),
    opacity 0.24s ease;
  pointer-events: none;
}
.ndt-card[data-open='true'] {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}
.ndt-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.ndt-card-title {
  font-size: 14px;
  font-weight: 600;
}
.ndt-icon-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--ndt-border);
  border-radius: 8px;
  background: transparent;
  color: var(--ndt-text);
  cursor: pointer;
  transition: background 0.15s ease;
}
.ndt-icon-btn:hover {
  background: var(--ndt-menu-hover);
}
.ndt-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ndt-field-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ndt-muted);
}
.ndt-segment {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--ndt-border);
  border-radius: 10px;
  background: var(--ndt-menu-hover);
}
.ndt-segment button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 30px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--ndt-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.25s var(--ndt-spring),
    color 0.2s ease;
}
.ndt-segment button[data-active='true'] {
  background: var(--ndt-surface);
  color: var(--ndt-text);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}
.ndt-hide-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 34px;
  border: 1px solid var(--ndt-border);
  border-radius: 10px;
  background: transparent;
  color: var(--ndt-text);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}
.ndt-hide-btn:hover {
  background: var(--ndt-menu-hover);
}
.ndt-note {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--ndt-muted);
}
.ndt-note code {
  font-family: ui-monospace, monospace;
  font-size: 10.5px;
}
@media (prefers-reduced-motion: reduce) {
  .ndt-item,
  .ndt-card,
  .ndt-segment button {
    transition-duration: 0.01ms !important;
  }
}
`;
