import { COLOR_PREFERENCE_STORAGE_KEY } from '@/utils/constants/common';

export default function getColor() {
  const colorPreference =
    typeof window !== 'undefined'
      ? window.localStorage.getItem(COLOR_PREFERENCE_STORAGE_KEY)
      : 'system';
  const prefersDarkMode =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;

  if (colorPreference === 'system') {
    return prefersDarkMode ? 'dark' : 'light';
  }

  return colorPreference as 'light' | 'dark';
}
