import { useQuery } from '@tanstack/react-query';
import type { AdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { getPreparedReadOnlyHasuraQuery } from '@/features/orgs/projects/database/common/utils/hasuraQueryHelpers';
import type { QueryResult } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { normalizeQueryError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeQueryError';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export const POSTGRES_EXTENSIONS_QUERY_KEY = 'postgres-extensions';

export interface PostgresExtension {
  name: string;
  default_version: string | null;
  installed_version: string | null;
  comment: string | null;
  /**
   * Extensions the default version depends on.
   */
  requires: string[];
}

const EXTENSIONS_SQL = `SELECT row_to_json(extension_data) AS data FROM (
  SELECT
    e.name,
    e.default_version,
    e.installed_version,
    e.comment,
    COALESCE(d.requires, '{}') AS requires
  FROM pg_available_extensions e
  LEFT JOIN pg_available_extension_versions d
    ON d.name = e.name AND d.version = e.default_version
  ORDER BY e.name ASC
) extension_data`;

async function fetchPostgresExtensions(
  { appUrl, adminSecret }: AdminApiTarget,
  dataSource: string,
): Promise<PostgresExtension[]> {
  const response = await fetch(`${appUrl}/v2/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      type: 'bulk',
      version: 1,
      args: [getPreparedReadOnlyHasuraQuery(dataSource, EXTENSIONS_SQL)],
    }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(normalizeQueryError(data));
  }

  // The first row holds the column names; each other row is one JSON value.
  const [, ...rows] = (data as QueryResult<string[][]>[])[0].result;

  try {
    return rows.map(([row]) => JSON.parse(row));
  } catch {
    throw new Error('Received an invalid extensions catalog.');
  }
}

export default function usePostgresExtensionsQuery(dataSource: string) {
  const { project } = useProject();
  const adminApi = useAdminApiTarget();

  return useQuery({
    queryKey: [POSTGRES_EXTENSIONS_QUERY_KEY, project?.subdomain, dataSource],
    queryFn: () => fetchPostgresExtensions(adminApi!, dataSource),
    enabled: Boolean(adminApi && dataSource),
  });
}
