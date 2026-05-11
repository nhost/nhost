import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import fetchSchemaDiagramData, {
  type SchemaDiagramData,
} from './fetchSchemaDiagramData';

export type {
  SchemaDiagramColumn,
  SchemaDiagramData,
  SchemaDiagramForeignKey,
} from './fetchSchemaDiagramData';

export const ALL_TABLE_COLUMNS_QUERY_KEY = 'schema-diagram-all-columns';
const STALE_TIME = 5 * 60_000;

export default function useAllTableColumns(
  dataSource: string = 'default',
): UseQueryResult<SchemaDiagramData, unknown> {
  const { project, loading } = useProject();

  return useQuery<SchemaDiagramData>({
    queryKey: [ALL_TABLE_COLUMNS_QUERY_KEY, project?.subdomain, dataSource],
    queryFn: () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );
      return fetchSchemaDiagramData({
        appUrl,
        adminSecret: project!.config!.hasura.adminSecret,
        dataSource,
      });
    },
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    enabled: !!(
      project?.subdomain &&
      project?.region &&
      project?.config?.hasura.adminSecret &&
      !loading
    ),
  });
}
