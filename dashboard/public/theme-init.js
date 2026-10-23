// Runs before the body is painted so the first frame already uses the right
// theme tokens. Served as a file (not inline) so the default CSP, which allows
// 'self' but not inline scripts, lets it run.
//
// Keep in sync with THEME_STORAGE_KEY, NO_TRANSITION_STYLE_ID and
// NO_TRANSITION_CSS (src/utils/constants/common, src/providers/Theme/utils),
// and with readStoredThemePreference/resolveTheme. themeInit.test.ts checks it.
//
// Transitions stay disabled until ThemeDocumentClass applies the preference,
// so styles loading late (e.g. in development) don't animate the colors in.
(function () {
  try {
    var style = document.createElement('style');
    style.id = 'nhost-theme-no-transition';
    style.textContent = '*,*::before,*::after{transition:none!important}';
    document.head.appendChild(style);
    var preference = localStorage.getItem('nhost-color-preference');
    var theme =
      preference === 'light' || preference === 'dark'
        ? preference
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  } catch (_error) {}
})();
