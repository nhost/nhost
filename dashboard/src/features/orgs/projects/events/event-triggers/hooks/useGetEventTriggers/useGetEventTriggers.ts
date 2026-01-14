import { fetchExportMetadata } from '@/features/orgs/projects/common/utils/fetchExportMetadata';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import type { EventTriggerViewModel } from '@/features/orgs/projects/events/event-triggers/types';
import parseEventTriggersFromMetadata from '@/features/orgs/projects/events/event-triggers/utils/parseEventTriggersFromMetadata/parseEventTriggersFromMetadata';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { ExportMetadataResponse } from '@/utils/hasura-api/generated/schemas';
import type { UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';

export interface UseGetEventTriggersOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: UseQueryOptions<
    ExportMetadataResponse,
    unknown,
    EventTriggerViewModel[]
  >;
}

/**
 * This hook is a wrapper around a fetch call that gets the event triggers from the metadata.
 *
 * @param options - Options to use for the query.
 * @returns The result of the query.
 */
export default function useGetEventTriggers({
  queryOptions,
}: UseGetEventTriggersOptions = {}) {
  const { project, loading } = useProject();

  const query = useQuery<
    ExportMetadataResponse,
    unknown,
    EventTriggerViewModel[]
  >(
    ['export-metadata', project?.subdomain],
    () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const adminSecret = project!.config!.hasura.adminSecret;

      return fetchExportMetadata({ appUrl, adminSecret });
    },
    {
      ...queryOptions,
      enabled: !!(
        project?.subdomain &&
        project?.region &&
        project?.config?.hasura.adminSecret &&
        queryOptions?.enabled !== false &&
        !loading
      ),
      select: (data) => parseEventTriggersFromMetadata(data.metadata),
    },
  );

  return query;
}
