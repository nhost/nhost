import {
  type UseQueryOptions,
  type UseQueryResult,
  useQuery,
} from '@tanstack/react-query';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import fetchSchemaDiagramData, {
  type SchemaDiagramData,
} from './fetchSchemaDiagramData';

export type {
  SchemaDiagramColumn,
  SchemaDiagramData,
  SchemaDiagramForeignKey,
  SchemaDiagramFunctionReturnType,
} from './fetchSchemaDiagramData';

export const ALL_TABLE_COLUMNS_QUERY_KEY = 'schema-diagram-all-columns';
const STALE_TIME = 5 * 60_000;

/**
 * A control-options subset of react-query's `UseQueryOptions`, forwarded into
 * the query — the same shape `useExportMetadata` accepts.
 */
export type UseAllTableColumnsOptions = Pick<
  UseQueryOptions<SchemaDiagramData>,
  'enabled' | 'staleTime'
> & {
  refetchOnMount?: boolean | 'always';
};

export default function useAllTableColumns(
  dataSource: string = 'default',
  options?: UseAllTableColumnsOptions,
): UseQueryResult<SchemaDiagramData, unknown> {
  const { project, loading } = useProject();
  const adminApi = useAdminApiTarget();

  return useQuery<SchemaDiagramData>({
    queryKey: [ALL_TABLE_COLUMNS_QUERY_KEY, project?.subdomain, dataSource],
    queryFn: () => {
      const appUrl = adminApi!.appUrl;
      return fetchSchemaDiagramData({
        appUrl,
        adminSecret: adminApi!.adminSecret,
        dataSource,
      });
    },
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    ...options,
    enabled: !!(
      project?.subdomain &&
      project?.region &&
      project?.config?.hasura.adminSecret &&
      options?.enabled !== false &&
      !loading
    ),
  });
}
