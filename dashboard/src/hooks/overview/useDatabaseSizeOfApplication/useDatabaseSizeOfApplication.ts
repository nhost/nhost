import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import type { QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import type { FetchProjectDatabaseSizeReturnType } from './fetchProjectDatabaseSize';
import fetchProjectDatabaseSize from './fetchProjectDatabaseSize';

/**
 * This hook will return the database size of the current project.
 *
 * @param queryKey The query key to use for caching.
 * @param queryOptions The queryOptions to use for the query.
 * @returns The database size of the current project.
 */
export default function useDatabaseSizeOfApplication(
  queryKey: QueryKey,
  queryOptions?: UseQueryOptions<FetchProjectDatabaseSizeReturnType>,
) {
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  return useQuery<FetchProjectDatabaseSizeReturnType>(
    queryKey,
    () =>
      fetchProjectDatabaseSize({
        subdomain:
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? 'localhost'
            : currentApplication?.subdomain,
        region: currentApplication?.region?.awsName,
        adminSecret:
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? 'nhost-admin-secret'
            : currentApplication?.hasuraGraphqlAdminSecret,
      }),
    {
      ...queryOptions,
      enabled: currentApplication?.hasuraGraphqlAdminSecret
        ? queryOptions?.enabled
        : false,
    },
  );
}
