'use client';

import { useCallback, useEffect, useState } from 'react';
import { localServiceURL, nhostRegion } from '@/lib/nhost/env';

export type Edge = 'left' | 'right' | 'top' | 'bottom';
export type Theme = 'dark' | 'light';

export interface ToolbarSettings {
  // Which screen edge the tab docks to.
  edge: Edge;
  // Position along that edge, as a percentage (clamped away from the corners).
  offset: number;
  // The toolbar's own appearance, independent of the page's theme.
  theme: Theme;
}

const STORAGE_KEY = 'nhost-dev-toolbar';
const HIDDEN_KEY = 'nhost-dev-toolbar-hidden';

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

function readSettings(): ToolbarSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// Toolbar preferences persisted to localStorage, plus a session-scoped "hidden"
// flag. `ready` stays false until the first client render so the server markup
// and the first client paint match (settings live only in the browser).
export function useToolbarSettings() {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<ToolbarSettings>(DEFAULT_SETTINGS);
  const [hidden, setHiddenState] = useState(false);

  useEffect(() => {
    setSettings(readSettings());

    let stored = false;
    try {
      const revealed =
        new URLSearchParams(window.location.search).get(REVEAL_PARAM) ===
        'true';

      if (revealed) {
        window.sessionStorage.removeItem(HIDDEN_KEY);
      } else {
        stored = window.sessionStorage.getItem(HIDDEN_KEY) === '1';
      }
    } catch {
      // Ignore storage failures (private mode, quota); showing the toolbar is
      // the safer side to fail on, since it is only ever a development build.
    }

    setHiddenState(stored);
    setReady(true);
  }, []);

  const update = useCallback((patch: Partial<ToolbarSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage failures (private mode, quota); state still applies.
      }
      return next;
    });
  }, []);

  const setHidden = useCallback((value: boolean) => {
    setHiddenState(value);
    try {
      if (value) {
        window.sessionStorage.setItem(HIDDEN_KEY, '1');
      } else {
        window.sessionStorage.removeItem(HIDDEN_KEY);
      }
    } catch {
      // Ignore storage failures; the in-memory flag still applies.
    }
  }, []);

  return { ready, settings, update, hidden, setHidden };
}

/**
 * Whether the app is talking to a local stack.
 *
 * Everything the toolbar links to is part of `nhost up`, so against a real
 * project those hostnames do not resolve. Being a development build is not
 * enough on its own: running `pnpm dev` against a deployed backend is an
 * ordinary thing to do, and the toolbar has nothing to offer there.
 */
export function isLocalBackend(): boolean {
  return nhostRegion() === 'local';
}

// The hostname pattern lives in lib/nhost/env so the toolbar and the sign-in
// page cannot end up pointing at different local stacks.
export function localServiceUrls() {
  return {
    dashboard: localServiceURL('dashboard'),
    mailhog: localServiceURL('mailhog'),
  };
}
