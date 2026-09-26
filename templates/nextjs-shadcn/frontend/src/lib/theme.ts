/**
 * Where the chosen theme is remembered between visits.
 *
 * This lives in its own module rather than next to the toggle because the root
 * layout needs it too, and the toggle is a `'use client'` file: a value
 * imported from one of those into a Server Component arrives as a client
 * reference, not as the string, so the script below would have read
 * `localStorage.getItem(undefined)` and never found anything.
 */
export const THEME_KEY = 'theme';

/**
 * Applies the stored theme before the first paint.
 *
 * Inline and blocking on purpose: a component cannot set the class early
 * enough to beat the first paint, and the server can read neither
 * localStorage nor the system preference, so it cannot render the class
 * itself. The only value substituted in is the constant above, escaped as a
 * JS literal; nothing from a request reaches this string.
 */
export const applyStoredTheme = `
try {
  var stored = localStorage.getItem(${JSON.stringify(THEME_KEY)});
  var dark = stored ? stored === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  if (dark) document.documentElement.classList.add('dark');
} catch (e) {}
`;
