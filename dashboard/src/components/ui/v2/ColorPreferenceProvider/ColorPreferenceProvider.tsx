import useMediaQuery from '@mui/material/useMediaQuery';
import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { COLOR_PREFERENCE_STORAGE_KEY } from '@/utils/constants/common';
import ColorPreferenceContext from './ColorPreferenceContext';

export interface ColorPreferenceProviderProps
  extends PropsWithChildren<unknown> {
  /**
   * The key used to store the color preference in the local storage.
   *
   * @default COLOR_PREFERENCE_STORAGE_KEY
   */
  colorPreferenceStorageKey?: string;
}

function ColorPreferenceProvider({
  children,
  colorPreferenceStorageKey = COLOR_PREFERENCE_STORAGE_KEY,
}: ColorPreferenceProviderProps) {
  const [colorPreference, setColorPreference] = useState<
    'light' | 'dark' | 'system'
  >('system');
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  // biome-ignore lint/correctness/useExhaustiveDependencies: need to run hook when prefersDarkmode changes
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedColorPreference = window.localStorage.getItem(
      colorPreferenceStorageKey,
    );

    if (
      !['light', 'dark', 'system'].includes(storedColorPreference as string)
    ) {
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
