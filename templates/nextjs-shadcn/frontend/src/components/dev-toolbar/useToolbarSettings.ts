'use client';

import { useCallback, useEffect, useState } from 'react';
import { localServiceURL } from '@/lib/nhost/env';

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
    setHiddenState(window.sessionStorage.getItem(HIDDEN_KEY) === '1');
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

// The hostname pattern lives in lib/nhost/env so the toolbar and the sign-in
// page cannot end up pointing at different local stacks.
export function localServiceUrls() {
  return {
    dashboard: localServiceURL('dashboard'),
    hasura: localServiceURL('hasura'),
    mailhog: localServiceURL('mailhog'),
  };
}
