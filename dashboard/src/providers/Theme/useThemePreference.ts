import { useContext } from 'react';
import ThemePreferenceContext from '@/providers/Theme/ThemeContext';

/**
 * Returns the current theme preference, the resolved theme, and a function to
 * change the preference.
 */
export default function useThemePreference() {
  const context = useContext(ThemePreferenceContext);

  if (!context) {
    throw new Error(
      'useThemePreference must be used within a ThemePreferenceProvider',
    );
  }

  return context;
}
