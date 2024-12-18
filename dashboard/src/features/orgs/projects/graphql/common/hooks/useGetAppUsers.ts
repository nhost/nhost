import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  RemoteAppGetUsersCustomQuery,
  RemoteAppGetUsersCustomQueryVariables,
} from '@/utils/__generated__/graphql';
import { useRemoteAppGetUsersCustomQuery } from '@/utils/__generated__/graphql';
import type { QueryHookOptions } from '@apollo/client';

export type UseFilesOptions = {
  searchString?: string;
  limit?: number;
  offset?: number;
  /**
   * Custom options for the query.
   */
  options?: QueryHookOptions<
    RemoteAppGetUsersCustomQuery,
    RemoteAppGetUsersCustomQueryVariables
  >;
};

export default function useGetAppUsers({
  searchString,
  limit = 250,
  offset = 0,
  options = {},
}: UseFilesOptions) {
  const { project } = useProject();
  const userApplicationClient = useRemoteApplicationGQLClient();
  const { data, error, loading } = useRemoteAppGetUsersCustomQuery({
    ...options,
    client: userApplicationClient,
    variables: {
      ...options.variables,
      where: searchString
        ? {
            displayName: { _ilike: `%${searchString}%` },
          }
        : {},
      limit,
      offset,
    },
    skip: !project,
  });

  const users = data?.users || [];

  return {
    users,
    loading,
    error,
  };
}
