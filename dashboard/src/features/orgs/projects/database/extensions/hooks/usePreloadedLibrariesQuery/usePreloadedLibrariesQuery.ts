import { useQuery } from '@tanstack/react-query';
import type { AdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { getPreparedReadOnlyHasuraQuery } from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import type { QueryResult } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { normalizeQueryError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeQueryError';
import { withPostgresRole } from '@/features/orgs/projects/database/extensions/utils/withPostgresRole';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

const POSTGRES_PRELOADED_LIBRARIES_QUERY_KEY = 'postgres-preloaded-libraries';

const PRELOADED_LIBRARIES_SQL = withPostgresRole(
  "SELECT trim(library) FROM unnest(string_to_array(current_setting('shared_preload_libraries'), ',')) AS library",
);

async function fetchPreloadedLibraries(
  { appUrl, adminSecret }: AdminApiTarget,
  dataSource: string,
): Promise<string[]> {
  const response = await fetch(`${appUrl}/v2/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      type: 'bulk',
      version: 1,
      args: [
        getPreparedReadOnlyHasuraQuery(dataSource, PRELOADED_LIBRARIES_SQL),
      ],
    }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(normalizeQueryError(data));
  }

  const [, ...rows] = (data as QueryResult<string[][]>[])[0].result;

  return rows.map(([library]) => library);
}

/**
 * Returns the libraries the running PostgreSQL server preloaded at startup.
 */
export default function usePreloadedLibrariesQuery(dataSource: string) {
  const { project } = useProject();
  const adminApi = useAdminApiTarget();

  return useQuery({
    queryKey: [
      POSTGRES_PRELOADED_LIBRARIES_QUERY_KEY,
      project?.subdomain,
      dataSource,
    ],
    queryFn: () => fetchPreloadedLibraries(adminApi!, dataSource),
    enabled: Boolean(adminApi && dataSource),
    retry: false,
  });
}
