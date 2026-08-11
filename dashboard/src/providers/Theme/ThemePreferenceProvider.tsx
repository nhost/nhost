import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import ThemePreferenceContext, {
  type ThemePreference,
} from '@/providers/Theme/ThemeContext';
import {
  readStoredThemePreference,
  resolveTheme,
} from '@/providers/Theme/utils';
import { THEME_STORAGE_KEY } from '@/utils/constants/common';

export interface ThemePreferenceProviderProps
  extends PropsWithChildren<unknown> {
  /**
   * The key used to store the theme preference in local storage.
   *
   * @default THEME_STORAGE_KEY
   */
  storageKey?: string;
}

function ThemePreferenceProvider({
  children,
  storageKey = THEME_STORAGE_KEY,
}: ThemePreferenceProviderProps) {
  const [themePreference, setThemePreference] =
    useState<ThemePreference>('system');
  const [prefersDark, setPrefersDark] = useState(false);

  useEffect(() => {
    setThemePreference(readStoredThemePreference(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setPrefersDark(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersDark(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const updateThemePreference = useCallback(
    (preference: ThemePreference) => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, preference);
      }

      setThemePreference(preference);
    },
    [storageKey],
  );

  const value = useMemo(
    () => ({
      themePreference,
      setThemePreference: updateThemePreference,
      resolvedTheme: resolveTheme(
        themePreference,
        prefersDark ? 'dark' : 'light',
      ),
      storageKey,
    }),
    [themePreference, updateThemePreference, prefersDark, storageKey],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

ThemePreferenceProvider.displayName = 'NhostThemePreferenceProvider';

export default ThemePreferenceProvider;
