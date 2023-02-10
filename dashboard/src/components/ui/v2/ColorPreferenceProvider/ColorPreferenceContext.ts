import { createContext } from 'react';

export interface ColorPreferenceContextProps {
  /**
   * The selected color theme based on the preference.
   *
   * @default 'light'
   */
  color: 'light' | 'dark';
  /**
   * The color preference.
   *
   * @default 'system'
   */
  colorPreference: 'light' | 'dark' | 'system';
  /**
   * The function used to set the color preference.
   */
  setColorPreference: (preference: 'light' | 'dark' | 'system') => void;
  /**
   * The key used to store the color preference in the local storage.
   *
   * @default 'color-preference'
   */
  colorPreferenceStorageKey: string;
}

const ColorPreferenceContext = createContext<ColorPreferenceContextProps>({
  color: 'light',
  colorPreference: 'system',
  setColorPreference: () => {},
  colorPreferenceStorageKey: 'color-preference',
});

export default ColorPreferenceContext;
