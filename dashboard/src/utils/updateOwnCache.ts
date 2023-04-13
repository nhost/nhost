import type { ApolloClient, ApolloQueryResult } from '@apollo/client';
import { GetAllWorkspacesAndProjectsDocument } from './__generated__/graphql';

/**
 * This function will refetch the main query we use for the cache
 * of the user's workspaces and applications.
 * @param client The apollo client instance.
 */
export async function updateOwnCache(
  client: ApolloClient<any>,
): Promise<ApolloQueryResult<any>[]> {
  return client.refetchQueries({
    include: [GetAllWorkspacesAndProjectsDocument],
  });
}

export default updateOwnCache;
