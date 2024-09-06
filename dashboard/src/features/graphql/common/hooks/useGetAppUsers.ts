import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
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
  const { currentProject } = useCurrentWorkspaceAndProject();
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
    skip: !currentProject,
  });

  const users = data?.users || [];

  return {
    users,
    loading,
    error,
  };
}
