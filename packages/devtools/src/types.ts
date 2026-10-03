export const EDGES = ['left', 'right', 'top', 'bottom'] as const;
export const THEMES = ['dark', 'light'] as const;

export type Edge = (typeof EDGES)[number];
export type Theme = (typeof THEMES)[number];

export interface ToolbarSettings {
  // Which screen edge the tab docks to.
  edge: Edge;
  // Position along that edge, as a percentage (clamped away from the corners).
  offset: number;
  // The toolbar's own appearance, independent of the page's theme.
  theme: Theme;
}

/**
 * Which backend the app is talking to.
 *
 * Both default to `local`, which is what `nhost up` serves, so a project that
 * has never set them gets a working toolbar with no configuration. A framework
 * that exposes its environment to the browser should pass its own values
 * through: `NEXT_PUBLIC_NHOST_SUBDOMAIN` in Next.js, `VITE_NHOST_SUBDOMAIN` in
 * Vite, and so on. There is no way for this package to read those itself.
 */
export interface BackendConfig {
  subdomain?: string | undefined;
  region?: string | undefined;
}
