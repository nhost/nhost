import { createContext } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = Exclude<ThemePreference, 'system'>;

export interface ThemePreferenceContextProps {
  /**
   * The theme applied after resolving `'system'` against the OS preference.
   */
  resolvedTheme: ResolvedTheme;
  /**
   * The user's chosen theme preference.
   *
   * @default 'system'
   */
  themePreference: ThemePreference;
  /**
   * Sets the theme preference.
   */
  setThemePreference: (preference: ThemePreference) => void;
  /**
   * The key used to store the theme preference in local storage.
   *
   * @default THEME_STORAGE_KEY
   */
  storageKey: string;
  /**
   * Whether the stored preference has been read on the client. Until then
   * `resolvedTheme` is the server default (`'light'`).
   */
  isLoaded: boolean;
}

const ThemePreferenceContext =
  createContext<ThemePreferenceContextProps | null>(null);

export default ThemePreferenceContext;
