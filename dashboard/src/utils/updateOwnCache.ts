import type { ApolloClient, ApolloQueryResult } from '@apollo/client';

/**
 * This function will refetch the main query we use for the cache
 * of the user's workspaces and applications.
 * @param client The apollo client instance.
 */
export async function updateOwnCache(
  client: ApolloClient<any>,
): Promise<ApolloQueryResult<any>[]> {
  return client.refetchQueries({
    include: ['getOneUser'],
  });
}

export default updateOwnCache;
