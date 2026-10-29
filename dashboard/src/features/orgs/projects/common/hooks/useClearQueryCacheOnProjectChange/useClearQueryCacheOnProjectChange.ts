import { useApolloClient } from '@apollo/client';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

/**
 * Clears the query cache when the user switches to another project or leaves
 * project pages, so data from one project never shows up in another.
 *
 * Apollo keeps the configuration of every project in one shared cache entry,
 * because the configuration queries use `id: __typename` as the cache id.
 * Removing the cached `config` fields means no query can read that entry
 * again, so the next project loads its own configuration from the network.
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
  const apolloClient = useApolloClient();

  useEffect(() => {
    if (!appSubdomain) {
      return undefined;
    }

    return () => {
      queryClient.clear();
      apolloClient.cache.evict({ id: 'ROOT_QUERY', fieldName: 'config' });
      apolloClient.cache.gc();
    };
  }, [queryClient, apolloClient, appSubdomain]);
}
