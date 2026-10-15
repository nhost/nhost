import { NO_TRANSITION_CSS, NO_TRANSITION_STYLE_ID } from './utils';

/**
 * Inline script that runs before the body is painted so the first frame
 * already uses the right theme tokens. Mirrors readStoredThemePreference and
 * resolveTheme. Transitions stay disabled until ThemeDocumentClass applies
 * the preference, so styles loading late (e.g. in development) don't animate
 * the colors in.
 *
 * Imported by `vite.config.ts`, which injects it into `index.html`, so this
 * module must only use relative imports.
 */
export function getThemeScript(storageKey: string) {
  return `(function () {
  try {
    var style = document.createElement('style');
    style.id = '${NO_TRANSITION_STYLE_ID}';
    style.textContent = '${NO_TRANSITION_CSS}';
    document.head.appendChild(style);
    var preference = localStorage.getItem('${storageKey}');
    var theme =
      preference === 'light' || preference === 'dark'
        ? preference
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  } catch (error) {}
})();`;
}
