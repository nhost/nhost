import type { ResolvedTheme } from '@/providers/Theme';
import {
  readStoredThemePreference,
  resolveTheme,
} from '@/providers/Theme/utils';
import { THEME_STORAGE_KEY } from '@/utils/constants/common';

/**
 * Resolves the active theme outside React (e.g. when building a toast, where
 * the `useThemePreference` hook is unavailable).
 */
export default function getResolvedTheme(): ResolvedTheme {
  const preference = readStoredThemePreference(THEME_STORAGE_KEY);
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  return resolveTheme(preference, prefersDark ? 'dark' : 'light');
}
