import type { UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { fetchExportMetadata } from '@/features/orgs/projects/common/utils/fetchExportMetadata';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { getEventTriggersByTable } from '@/features/orgs/projects/events/event-triggers/utils/getEventTriggersByTable';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  EventTrigger,
  ExportMetadataResponse,
  QualifiedTable,
} from '@/utils/hasura-api/generated/schemas';

export interface UseGetEventTriggersByTableOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: UseQueryOptions<
    ExportMetadataResponse,
    unknown,
    EventTrigger[]
  >;
  /**
   * The table to get the event triggers for.
   */
  table: QualifiedTable;
  /**
   * The data source to get the event triggers for.
   */
  dataSource: string;
}

/**
 * This hook is a wrapper around a fetch call that gets the event triggers by table from the metadata.
 *
 * @param options - Options to use for the query.
 * @returns The result of the query.
 */
export default function useGetEventTriggersByTable({
  table,
  dataSource,
  queryOptions,
}: UseGetEventTriggersByTableOptions) {
  const { project, loading } = useProject();

  const query = useQuery<ExportMetadataResponse, unknown, EventTrigger[]>({
    queryKey: ['export-metadata', project?.subdomain],
    queryFn: () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const adminSecret = project!.config!.hasura.adminSecret;

      return fetchExportMetadata({ appUrl, adminSecret });
    },
    ...queryOptions,
    enabled: !!(
      project?.subdomain &&
      project?.region &&
      project?.config?.hasura.adminSecret &&
      queryOptions?.enabled !== false &&
      !loading
    ),
    select: (data) =>
      getEventTriggersByTable({
        metadata: data.metadata,
        table,
        dataSource,
      }),
  });

  return query;
}
