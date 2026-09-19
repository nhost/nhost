import { isLocalBackend, localServiceUrls } from './config';
import { TOOLBAR_CSS } from './css';
import { element, setStyles } from './dom';
import {
  cardAnchor,
  clampAnchor,
  DRAG_THRESHOLD,
  growthOffset,
  isVertical,
  NARROW,
  palette,
  restingCenter,
  SPRING_TAU,
  STRIP,
  tooltipStyle,
} from './geometry';
import { type IconName, icon, nhostLogo } from './icons';
import {
  readHidden,
  readSettings,
  writeHidden,
  writeSettings,
} from './settings';
import { nearestEdge } from './snap';
import { trapezoid } from './trapezoid';
import type { BackendConfig, Edge, Theme, ToolbarSettings } from './types';

export interface DevToolbarOptions extends BackendConfig {
  /** Where to mount. Defaults to `document.body`. */
  target?: HTMLElement | undefined;
}

/** Takes the toolbar back off the page. Safe to call more than once. */
export type UnmountDevToolbar = () => void;

const NOOP: UnmountDevToolbar = () => {};

const SERVICES = [
  { label: 'Hasura', key: 'hasura', glyph: 'database' },
  { label: 'Mail', key: 'mailhog', glyph: 'mail' },
] as const satisfies ReadonlyArray<{
  label: string;
  key: 'hasura' | 'mailhog';
  glyph: IconName;
}>;

const EDGE_CHOICES: ReadonlyArray<{ value: Edge; label: string }> = [
  { value: 'left', label: 'Left' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'right', label: 'Right' },
];

const THEME_CHOICES: ReadonlyArray<{
  value: Theme;
  label: string;
  glyph: IconName;
}> = [
  { value: 'dark', label: 'Dark', glyph: 'moon' },
  { value: 'light', label: 'Light', glyph: 'sun' },
];

/**
 * Put the Nhost development toolbar on the page.
 *
 * Refuses in three cases, each returning an unmount that does nothing: there is
 * no document (a server render), the app is not pointed at a local backend, or
 * this session has already hidden the toolbar. Everything it links to belongs
 * to `nhost up`, so against a deployed project those hostnames do not resolve
 * and there would be nothing to show.
 *
 * This package is meant to be a devDependency and nothing here checks
 * `NODE_ENV`: the decision to import it at all is the consumer's, and a
 * library cannot assume its own bundler defines that variable.
 */
export function mountNhostDevToolbar(
  options: DevToolbarOptions = {},
): UnmountDevToolbar {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return NOOP;
  }
  if (!isLocalBackend(options) || readHidden()) {
    return NOOP;
  }

  const urls = localServiceUrls(options);
  const parent = options.target ?? document.body;

  let settings = readSettings();
  let prefsOpen = false;
  let dragging = false;
  let viewport = { w: window.innerWidth, h: window.innerHeight };
  let hover: { label: string; pos: number } | null = null;
  let lastHover = { label: '', pos: 1 };
  let mounted = true;

  // Spring animation state: `cur` is what is rendered, eased toward the target.
  const cur = { cx: 0, cy: 0 };
  const posTarget = { cx: 0, cy: 0 };
  let raf = 0;

  // A drag outlives the pointerdown that started it: its listeners live on the
  // window and the click guard on a timer, so both are held here for an unmount
  // that happens mid-gesture to undo.
  let justDragged = false;
  let dragListeners: AbortController | null = null;
  let clickGuard = 0;

  // Every listener this mount adds, so unmounting drops all of them at once.
  const listeners = new AbortController();
  const { signal } = listeners;

  const root = element('div', 'ndt-root');
  const styles = element('style');
  styles.textContent = TOOLBAR_CSS;
  root.append(styles);

  const vertical = isVertical(settings.edge);
  const colors = palette(settings.theme);
  let shape = trapezoid(
    settings.edge,
    vertical ? NARROW : STRIP,
    vertical ? STRIP : NARROW,
    colors.from,
    colors.to,
  );
  // Only redrawn when the edge or the theme changes, never per frame.
  let shapeKey = `${settings.edge}|${settings.theme}`;
  root.append(shape);

  const strip = element('div', 'ndt-strip');
  root.append(strip);

  const setHover = (next: { label: string; pos: number } | null) => {
    hover = next;
    render();
  };

  const trackHover = (node: HTMLElement, label: string, pos: number) => {
    node.addEventListener('pointerenter', () => setHover({ label, pos }), {
      signal,
    });
    node.addEventListener('focus', () => setHover({ label, pos }), { signal });
    node.addEventListener('blur', () => setHover(null), { signal });
  };

  // `draggable=false` on every anchor: a link is draggable by default, so
  // without it a mouse press on one starts the browser's own link drag instead
  // of moving the tab. `touch-action` covers touch and pen only. The mark keeps
  // `ndt-handle` because that is the anchor the strip is positioned from.
  const linkAttributes = (href: string, label: string) => ({
    href,
    target: '_blank',
    rel: 'noreferrer',
    draggable: 'false',
    'aria-label': label,
  });

  const handle = element(
    'a',
    'ndt-handle',
    linkAttributes(urls.dashboard, 'Nhost Dashboard'),
  );
  handle.append(nhostLogo(14, 15));
  trackHover(handle, 'Dashboard', 0);
  strip.append(handle);

  SERVICES.forEach((service, index) => {
    const link = element(
      'a',
      'ndt-item',
      linkAttributes(urls[service.key], service.label),
    );
    link.append(icon(service.glyph, 13));
    trackHover(link, service.label, index + 1);
    strip.append(link);
  });

  const gear = element('button', 'ndt-item', {
    type: 'button',
    'aria-label': 'Preferences',
  });
  gear.append(icon('settings', 13));
  trackHover(gear, 'Preferences', SERVICES.length + 1);
  gear.addEventListener(
    'click',
    () => {
      prefsOpen = !prefsOpen;
      render();
    },
    { signal },
  );
  strip.append(gear);

  const tooltip = element('div', 'ndt-tooltip', { 'aria-hidden': 'true' });
  root.append(tooltip);

  const card = element('div', 'ndt-card');
  root.append(card);

  const head = element('div', 'ndt-card-head');
  const title = element('span', 'ndt-card-title');
  title.textContent = 'Preferences';
  const close = element('button', 'ndt-icon-btn', {
    type: 'button',
    'aria-label': 'Close',
  });
  close.append(icon('x', 16));
  close.addEventListener(
    'click',
    () => {
      prefsOpen = false;
      render();
    },
    { signal },
  );
  head.append(title, close);
  card.append(head);

  const field = (label: string) => {
    const wrapper = element('div', 'ndt-field');
    const caption = element('span', 'ndt-field-label');
    caption.textContent = label;
    const segment = element('div', 'ndt-segment');
    wrapper.append(caption, segment);
    card.append(wrapper);
    return segment;
  };

  const edgeSegment = field('Position');
  const edgeButtons = EDGE_CHOICES.map((choice) => {
    const button = element('button', undefined, { type: 'button' });
    button.textContent = choice.label;
    button.addEventListener('click', () => update({ edge: choice.value }), {
      signal,
    });
    edgeSegment.append(button);
    return [choice.value, button] as const;
  });

  const themeSegment = field('Theme');
  const themeButtons = THEME_CHOICES.map((choice) => {
    const button = element('button', undefined, { type: 'button' });
    button.append(icon(choice.glyph, 14), choice.label);
    button.addEventListener('click', () => update({ theme: choice.value }), {
      signal,
    });
    themeSegment.append(button);
    return [choice.value, button] as const;
  });

  const hide = element('button', 'ndt-hide-btn', { type: 'button' });
  hide.append(icon('eye-off', 15), 'Hide for this session');
  hide.addEventListener(
    'click',
    () => {
      writeHidden(true);
      unmount();
    },
    { signal },
  );
  card.append(hide);

  const note = element('p', 'ndt-note');
  const packageName = element('code');
  packageName.textContent = '@nhost/devtools';
  note.append('Dev only. Remove the ', packageName, ' import to drop it.');
  card.append(note);

  function renderPosition() {
    const growth = growthOffset(settings.edge);
    const upright = isVertical(settings.edge);
    setStyles(root, {
      position: 'fixed',
      left: `${cur.cx + growth.dx}px`,
      top: `${cur.cy + growth.dy}px`,
      translate: '-50% -50%',
      width: `${upright ? NARROW : STRIP}px`,
      height: `${upright ? STRIP : NARROW}px`,
    });
  }

  function render() {
    root.setAttribute('data-theme', settings.theme);
    root.setAttribute('data-edge', settings.edge);
    root.setAttribute('data-dragging', String(dragging));
    root.setAttribute('data-prefs', String(prefsOpen));

    const key = `${settings.edge}|${settings.theme}`;
    if (key !== shapeKey) {
      shapeKey = key;
      const upright = isVertical(settings.edge);
      const shades = palette(settings.theme);
      const next = trapezoid(
        settings.edge,
        upright ? NARROW : STRIP,
        upright ? STRIP : NARROW,
        shades.from,
        shades.to,
      );
      shape.replaceWith(next);
      shape = next;
    }

    if (hover) {
      lastHover = hover;
    }
    tooltip.textContent = lastHover.label;
    setStyles(tooltip, tooltipStyle(settings.edge, lastHover.pos));
    tooltip.setAttribute('data-show', String(hover !== null && !prefsOpen));

    // `inert` rather than `aria-hidden`: the closed card is only faded out, and
    // opacity does not take its eight controls out of the tab order or out of
    // the accessibility tree. Every page of the app would otherwise collect
    // that many invisible tab stops.
    card.setAttribute('data-open', String(prefsOpen));
    card.toggleAttribute('inert', !prefsOpen);
    setStyles(card, cardAnchor(settings.edge));

    for (const [edge, button] of edgeButtons) {
      button.setAttribute('data-active', String(settings.edge === edge));
    }
    for (const [theme, button] of themeButtons) {
      button.setAttribute('data-active', String(settings.theme === theme));
    }

    renderPosition();
  }

  function animate() {
    if (raf) {
      return;
    }
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const kPos = 1 - Math.exp(-dt / SPRING_TAU);
      cur.cx += (posTarget.cx - cur.cx) * kPos;
      cur.cy += (posTarget.cy - cur.cy) * kPos;
      const settled =
        Math.abs(posTarget.cx - cur.cx) < 0.3 &&
        Math.abs(posTarget.cy - cur.cy) < 0.3;
      if (settled) {
        cur.cx = posTarget.cx;
        cur.cy = posTarget.cy;
        raf = 0;
        renderPosition();
        return;
      }
      renderPosition();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  // Drive the docked position toward its rest, unless a drag owns it.
  function settle(animated = true) {
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
    if (!dragging) {
      posTarget.cx = anchor.cx;
      posTarget.cy = anchor.cy;
    }
    if (animated) {
      animate();
      return;
    }
    cur.cx = posTarget.cx;
    cur.cy = posTarget.cy;
    renderPosition();
  }

  function update(patch: Partial<ToolbarSettings>) {
    settings = { ...settings, ...patch };
    writeSettings(settings);
    render();
    settle();
  }

  function unmount() {
    if (!mounted) {
      return;
    }
    mounted = false;
    listeners.abort();
    dragListeners?.abort();
    dragListeners = null;
    window.clearTimeout(clickGuard);
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    root.remove();
  }

  // Drag detection lives on the whole tab. Anywhere you press can start a drag;
  // a press that never crosses the threshold is left to fire its normal click
  // (toggle the menu, open a link), while a real drag repositions the tab and
  // its trailing click is swallowed so it does not also activate a button.
  strip.addEventListener(
    'pointerdown',
    (event) => {
      // Only one drag gesture is ever live: a second pointer landing on the
      // strip (two fingers, or a second mouse button) abandons the first so
      // its stale window listeners cannot outlive it and, past an unmount,
      // write a new edge on the next release anywhere on the page.
      dragListeners?.abort();
      const start = { x: event.clientX, y: event.clientY };
      const gesture = new AbortController();
      let moved = false;

      const move = (ev: PointerEvent) => {
        if (!mounted) {
          return;
        }
        if (
          !moved &&
          Math.hypot(ev.clientX - start.x, ev.clientY - start.y) >
            DRAG_THRESHOLD
        ) {
          moved = true;
          dragging = true;
          prefsOpen = false;
          render();
        }
        if (moved) {
          posTarget.cx = ev.clientX;
          posTarget.cy = ev.clientY;
          animate();
        }
      };

      const up = (ev: PointerEvent) => {
        gesture.abort();
        dragListeners = null;
        if (!mounted) {
          return;
        }
        if (!moved) {
          return;
        }
        dragging = false;
        justDragged = true;
        clickGuard = window.setTimeout(() => {
          justDragged = false;
        }, 150);
        update(
          nearestEdge(
            ev.clientX,
            ev.clientY,
            window.innerWidth,
            window.innerHeight,
          ),
        );
      };

      window.addEventListener('pointermove', move, { signal: gesture.signal });
      window.addEventListener('pointerup', up, { signal: gesture.signal });
      window.addEventListener('pointercancel', up, { signal: gesture.signal });
      dragListeners = gesture;
    },
    { signal },
  );

  strip.addEventListener(
    'click',
    (event) => {
      if (justDragged) {
        event.preventDefault();
        event.stopPropagation();
        justDragged = false;
      }
    },
    { signal, capture: true },
  );

  strip.addEventListener('pointerleave', () => setHover(null), { signal });

  window.addEventListener(
    'resize',
    () => {
      viewport = { w: window.innerWidth, h: window.innerHeight };
      settle();
    },
    { signal },
  );

  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && prefsOpen) {
        prefsOpen = false;
        render();
      }
    },
    { signal },
  );

  // Anything outside the toolbar dismisses the preferences. Tested against the
  // whole root rather than the card alone, so the gear that opened it is
  // inside too and its own click is not read as an outside one, which would
  // close and reopen in the same gesture.
  window.addEventListener(
    'pointerdown',
    (event) => {
      if (!prefsOpen) {
        return;
      }
      // A press that did not land on a node at all cannot have landed inside
      // the toolbar, and `contains` throws rather than saying so.
      const target = event.target;
      if (target instanceof Node && root.contains(target)) {
        return;
      }
      prefsOpen = false;
      render();
    },
    { signal },
  );

  render();
  settle(false);
  parent.append(root);

  return unmount;
}
