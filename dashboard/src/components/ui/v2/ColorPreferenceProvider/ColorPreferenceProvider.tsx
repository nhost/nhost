import useMediaQuery from '@mui/material/useMediaQuery';
import type { PropsWithChildren } from 'react';
import { useEffect, useMemo, useState } from 'react';
import ColorPreferenceContext from './ColorPreferenceContext';

export interface ColorPreferenceProviderProps
  extends PropsWithChildren<unknown> {
  /**
   * The key used to store the color preference in the local storage.
   *
   * @default 'color-preference'
   */
  colorPreferenceStorageKey?: string;
}

function ColorPreferenceProvider({
  children,
  colorPreferenceStorageKey = 'color-mode',
}: ColorPreferenceProviderProps) {
  const [colorPreference, setColorPreference] = useState<
    'light' | 'dark' | 'system'
  >('light');
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedColorPreference = window.localStorage.getItem(
      colorPreferenceStorageKey,
    );

    if (storedColorPreference === 'system') {
      setColorPreference(prefersDarkMode ? 'dark' : 'light');

      return;
    }

    if (storedColorPreference !== 'light' && storedColorPreference !== 'dark') {
      setColorPreference('light');
      return;
    }

    setColorPreference(storedColorPreference as 'light' | 'dark');
  }, [colorPreferenceStorageKey, prefersDarkMode]);

  const memoizedValue = useMemo(() => {
    const returnValues = {
      colorPreference,
      setColorPreference,
      colorPreferenceStorageKey,
    };

    if (colorPreference === 'system') {
      return {
        ...returnValues,
        color: prefersDarkMode ? ('dark' as const) : ('light' as const),
      };
    }

    return { ...returnValues, color: colorPreference };
  }, [colorPreference, colorPreferenceStorageKey, prefersDarkMode]);

  return (
    <ColorPreferenceContext.Provider value={memoizedValue}>
      {children}
    </ColorPreferenceContext.Provider>
  );
}

ColorPreferenceProvider.displayName = 'NhostColorPreferenceProvider';

export default ColorPreferenceProvider;
