import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
  type NormalizedCacheObject,
} from '@apollo/client';
import { useMemo } from 'react';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isNotEmptyValue } from '@/lib/utils';

// Module-level cache so the same ApolloClient (and its warm cache) is reused
// across component mounts. Without this, remounting a consumer would build a
// fresh client and refetch, causing visible flicker.
const clientCache = new Map<string, ApolloClient<NormalizedCacheObject>>();

function getCachedClient(
  key: string,
  build: () => ApolloClient<NormalizedCacheObject>,
) {
  // Tests run against per-file MSW servers with different handler setups; a
  // module-level cache would leak a warm Apollo cache across test files and
  // return stale data. Skip caching in test mode.
  if (process.env.TEST_MODE === 'true') {
    return build();
  }
  const existing = clientCache.get(key);
  if (existing) {
    return existing;
  }
  const created = build();
  clientCache.set(key, created);
  return created;
}

/**
 * Returns the Apollo client that talks to the project's remote GraphQL
 * endpoint. Clients are cached per project so repeated mounts share the same
 * cache — avoids redundant refetches and UI flicker.
 */
export default function useRemoteApplicationGQLClient() {
  const { project } = useProject();

  const userApplicationClient = useMemo(() => {
    if (!isNotEmptyValue(project)) {
      return getCachedClient(
        '__no_project__',
        () => new ApolloClient({ cache: new InMemoryCache() }),
      );
    }

    const projectAdminSecret = project.config!.hasura.adminSecret;
    const cacheKey = `${project.subdomain}.${project.region}.${projectAdminSecret}`;

    return getCachedClient(cacheKey, () => {
      const serviceUrl = generateAppServiceUrl(
        project.subdomain,
        project.region,
        'graphql',
      );

      return new ApolloClient({
        cache: new InMemoryCache(),
        link: new HttpLink({
          uri: serviceUrl,
          headers: {
            'x-hasura-admin-secret': projectAdminSecret,
          },
        }),
      });
    });
  }, [project]);

  return userApplicationClient;
}
