import type {
  ResolvedTheme,
  ThemePreference,
} from '@/providers/Theme/ThemeContext';

const themePreferences: ThemePreference[] = ['light', 'dark', 'system'];

// Disables transitions while the theme class changes, so colors switch
// instantly instead of animating (e.g. buttons with transition-colors).
export const NO_TRANSITION_STYLE_ID = 'nhost-theme-no-transition';
export const NO_TRANSITION_CSS =
  '*,*::before,*::after{transition:none!important}';

export function isThemePreference(
  value: string | null,
): value is ThemePreference {
  return themePreferences.includes(value as ThemePreference);
}

export function readStoredThemePreference(storageKey: string): ThemePreference {
  if (typeof window === 'undefined') {
    return 'system';
  }

  const stored = window.localStorage.getItem(storageKey);

  return isThemePreference(stored) ? stored : 'system';
}

export function resolveTheme(
  preference: ThemePreference,
  systemTheme: ResolvedTheme,
): ResolvedTheme {
  return preference === 'system' ? systemTheme : preference;
}
