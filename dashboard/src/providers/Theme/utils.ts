import type {
  ResolvedTheme,
  ThemePreference,
} from '@/providers/Theme/ThemeContext';

const themePreferences: ThemePreference[] = ['light', 'dark', 'system'];

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
