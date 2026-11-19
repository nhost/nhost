import { useAuth } from '@/lib/nhost/auth';

/**
 * Loads every page's data again and re-runs the session guard, as
 * `router.refresh()` does for a server-rendered page.
 */
export function useRefresh(): VoidFunction {
  return useAuth().refresh;
}
