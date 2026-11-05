import { useQuery } from '@tanstack/react-query';
import type { AdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { getPreparedReadOnlyHasuraQuery } from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import type { QueryResult } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { normalizeQueryError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeQueryError';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export const POSTGRES_PRELOADED_LIBRARIES_QUERY_KEY =
  'postgres-preloaded-libraries';

// Only roles with `pg_read_all_settings` may read this setting, so the
// read-only transaction runs as `postgres`.
const PRELOADED_LIBRARIES_SQL = `SET LOCAL ROLE postgres;
SELECT current_setting('shared_preload_libraries')`;

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

  const [, [libraries = ''] = []] = (data as QueryResult<string[][]>[])[0]
    .result;

  return libraries
    .split(',')
    .map((library) => library.trim())
    .filter(Boolean);
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
