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
   * Installable versions, newest first.
   */
  versions: string[];
}

const EXTENSIONS_SQL = `SELECT row_to_json(extension_data) AS data FROM (
  SELECT
    e.name,
    e.default_version,
    e.installed_version,
    e.comment,
    COALESCE(
      (
        SELECT array_agg(v.version)
        FROM pg_available_extension_versions v
        WHERE v.name = e.name AND v.version NOT IN ('ANY', 'unpackaged')
      ),
      '{}'
    ) AS versions
  FROM pg_available_extensions e
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

  let extensions: PostgresExtension[];

  try {
    extensions = rows.map(([row]) => JSON.parse(row));
  } catch {
    throw new Error('Received an invalid extensions catalog.');
  }

  for (const { versions } of extensions) {
    versions.sort((left, right) =>
      right.localeCompare(left, undefined, { numeric: true }),
    );
  }

  return extensions;
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
