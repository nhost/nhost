import { ColorPreferenceContext } from '@/components/ui/v2/ColorPreferenceProvider';
import { useContext } from 'react';

/**
 * Returns the current color Preference and a function to change it.
 */
export default function useColorPreference() {
  const context = useContext(ColorPreferenceContext);

  if (!context) {
    throw new Error(
      'useColorPreference must be used within a ColorPreferenceProvider',
    );
  }

  return context;
}
