import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

/**
 * Clears the query cache when the user switches to another project or leaves
 * project pages, so data from one project never shows up in another.
 *
 * Call it from a component that stays mounted while the user moves between
 * pages of the same project (`ProjectScope`). Anything that remounts on
 * section navigation would clear the cache on every section switch.
 */
export default function useClearQueryCacheOnProjectChange() {
  const {
    query: { appSubdomain },
  } = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!appSubdomain) {
      return undefined;
    }

    return () => {
      queryClient.clear();
    };
  }, [queryClient, appSubdomain]);
}
