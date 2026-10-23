import { useEffect } from 'react';
import useThemePreference from '@/providers/Theme/useThemePreference';
import {
  NO_TRANSITION_CSS,
  NO_TRANSITION_STYLE_ID,
} from '@/providers/Theme/utils';

function ThemeDocumentClass() {
  const { resolvedTheme, isLoaded } = useThemePreference();

  useEffect(() => {
    // public/theme-init.js already set the class; wait for the
    // real preference instead of overwriting it with the server default.
    if (!isLoaded) {
      return;
    }

    // Reuse the style theme-init.js added on page load, otherwise add one
    // so a theme switch doesn't animate colors either.
    const style =
      document.getElementById(NO_TRANSITION_STYLE_ID) ??
      document.head.appendChild(
        Object.assign(document.createElement('style'), {
          id: NO_TRANSITION_STYLE_ID,
          textContent: NO_TRANSITION_CSS,
        }),
      );

    const rootElement = document.documentElement;
    rootElement.classList.remove('light', 'dark');
    rootElement.classList.add(resolvedTheme);

    // Apply the new colors while transitions are off, then turn them back on.
    window.getComputedStyle(document.body);
    const timeout = window.setTimeout(() => style.remove(), 1);

    return () => {
      window.clearTimeout(timeout);
      style.remove();
    };
  }, [resolvedTheme, isLoaded]);

  return null;
}

ThemeDocumentClass.displayName = 'NhostThemeDocumentClass';

export default ThemeDocumentClass;
