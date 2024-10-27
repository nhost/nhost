import { isPlatform } from '@/utils/env';

/**
 * Returns `true` if all features of the dashboard should be enabled.
 */
export default function useIsPlatform() {
  return isPlatform();
}
