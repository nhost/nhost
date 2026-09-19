import { clamp, OFFSET_MAX, OFFSET_MIN } from './snap';
import {
  EDGES,
  type Edge,
  THEMES,
  type Theme,
  type ToolbarSettings,
} from './types';

const STORAGE_KEY = 'nhost-dev-toolbar';
const HIDDEN_KEY = 'nhost-dev-toolbar-hidden';

/**
 * Stamped into every stored payload and required to match on the way back in.
 *
 * Validation below rejects a field whose *type* changed, but not one whose
 * meaning changed: turn `offset` from a percentage into pixels and every
 * existing value stays a valid number and lands the tab somewhere absurd. Bump
 * this in that case and the old payload is discarded instead.
 */
const SETTINGS_VERSION = 1;

/**
 * The way back once the toolbar has been hidden.
 *
 * Hiding it removes the only control that could bring it back, so without a
 * second door the answer is "clear your session storage". `?nhost-devtools=true`
 * clears the flag outright rather than overriding it for one render, so the
 * toolbar stays up once the parameter is gone from the URL.
 */
const REVEAL_PARAM = 'nhost-devtools';

export const DEFAULT_SETTINGS: ToolbarSettings = {
  edge: 'right',
  offset: 50,
  theme: 'dark',
};

/**
 * A stored payload turned back into settings, one field at a time.
 *
 * Everything here came out of a store the user can edit, so nothing is trusted:
 * a bad field falls back to its default rather than failing the whole read, and
 * `{"offset":"banana"}` used to reach the style attribute as `NaN` and put the
 * tab off its edge. Takes the raw string so the malformed-JSON case is part of
 * the same function.
 */
export function parseSettings(raw: unknown): ToolbarSettings {
  if (typeof raw !== 'string') {
    return DEFAULT_SETTINGS;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_SETTINGS;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return DEFAULT_SETTINGS;
  }

  const stored = parsed as Record<string, unknown>;
  if (stored['version'] !== SETTINGS_VERSION) {
    return DEFAULT_SETTINGS;
  }

  const edge = stored['edge'];
  const theme = stored['theme'];
  const offset = stored['offset'];

  return {
    edge: EDGES.includes(edge as Edge) ? (edge as Edge) : DEFAULT_SETTINGS.edge,
    theme: THEMES.includes(theme as Theme)
      ? (theme as Theme)
      : DEFAULT_SETTINGS.theme,
    offset:
      typeof offset === 'number' && Number.isFinite(offset)
        ? clamp(offset, OFFSET_MIN, OFFSET_MAX)
        : DEFAULT_SETTINGS.offset,
  };
}

export function readSettings(): ToolbarSettings {
  try {
    return parseSettings(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(settings: ToolbarSettings): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: SETTINGS_VERSION, ...settings }),
    );
  } catch {
    // Ignore storage failures (private mode, quota); state still applies.
  }
}

// Whether this session asked for the toolbar to stay away, honouring the
// reveal parameter described above.
export function readHidden(): boolean {
  try {
    const revealed =
      new URLSearchParams(window.location.search).get(REVEAL_PARAM) === 'true';

    if (revealed) {
      window.sessionStorage.removeItem(HIDDEN_KEY);
      return false;
    }

    return window.sessionStorage.getItem(HIDDEN_KEY) === '1';
  } catch {
    // Ignore storage failures (private mode, quota); showing the toolbar is the
    // safer side to fail on, since it is only ever a development build.
    return false;
  }
}

export function writeHidden(value: boolean): void {
  try {
    if (value) {
      window.sessionStorage.setItem(HIDDEN_KEY, '1');
    } else {
      window.sessionStorage.removeItem(HIDDEN_KEY);
    }
  } catch {
    // Ignore storage failures; the in-memory flag still applies.
  }
}
