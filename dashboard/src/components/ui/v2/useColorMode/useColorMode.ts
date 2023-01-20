import { useMediaQuery } from '@mui/material';
import { useEffect, useState } from 'react';

export interface UseColorModeOptions {
  /**
   * The key to use in local storage to store the color mode.
   */
  colorModeStorageKey?: string;
}

export default function useColorMode({ colorModeStorageKey }) {
  const state = useState<'light' | 'dark'>('light');
  const [, setColorMode] = state;
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedColorMode = window.localStorage.getItem(colorModeStorageKey);

    if (storedColorMode === 'system') {
      setColorMode(prefersDarkMode ? 'dark' : 'light');
      return;
    }

    if (storedColorMode !== 'light' && storedColorMode !== 'dark') {
      setColorMode('light');
      return;
    }

    setColorMode(storedColorMode as 'light' | 'dark');
  }, [colorModeStorageKey, prefersDarkMode, setColorMode]);

  return state;
}
