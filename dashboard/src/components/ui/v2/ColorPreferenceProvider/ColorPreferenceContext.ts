import { createContext } from 'react';
import { COLOR_PREFERENCE_STORAGE_KEY } from '@/utils/constants/common';

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
   * @default COLOR_PREFERENCE_STORAGE_KEY
   */
  colorPreferenceStorageKey: string;
}

const ColorPreferenceContext = createContext<ColorPreferenceContextProps>({
  color: 'light',
  colorPreference: 'system',
  setColorPreference: () => {},
  colorPreferenceStorageKey: COLOR_PREFERENCE_STORAGE_KEY,
});

export default ColorPreferenceContext;
