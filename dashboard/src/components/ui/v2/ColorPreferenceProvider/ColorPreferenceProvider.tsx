import useMediaQuery from '@mui/material/useMediaQuery';
import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  >('system');
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedColorPreference = window.localStorage.getItem(
      colorPreferenceStorageKey,
    );

    if (!['light', 'dark', 'system'].includes(storedColorPreference)) {
      setColorPreference('system');

      return;
    }

    setColorPreference(storedColorPreference as typeof colorPreference);
  }, [colorPreferenceStorageKey, prefersDarkMode]);

  const updateColorPreference = useCallback(
    (preference: typeof colorPreference) => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(colorPreferenceStorageKey, preference);
      }

      setColorPreference(preference);
    },
    [colorPreferenceStorageKey],
  );

  const memoizedValue = useMemo(() => {
    const returnValues = {
      colorPreference,
      setColorPreference: updateColorPreference,
      colorPreferenceStorageKey,
    };

    if (colorPreference === 'system') {
      return {
        ...returnValues,
        color: prefersDarkMode ? ('dark' as const) : ('light' as const),
      };
    }

    return { ...returnValues, color: colorPreference };
  }, [
    colorPreference,
    colorPreferenceStorageKey,
    prefersDarkMode,
    updateColorPreference,
  ]);

  return (
    <ColorPreferenceContext.Provider value={memoizedValue}>
      {children}
    </ColorPreferenceContext.Provider>
  );
}

ColorPreferenceProvider.displayName = 'NhostColorPreferenceProvider';

export default ColorPreferenceProvider;
