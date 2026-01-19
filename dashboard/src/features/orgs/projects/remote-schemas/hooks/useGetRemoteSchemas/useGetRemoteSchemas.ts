import type { UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { fetchExportMetadata } from '@/features/orgs/projects/common/utils/fetchExportMetadata';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  ExportMetadataResponse,
  RemoteSchemaInfo,
} from '@/utils/hasura-api/generated/schemas';

export interface UseGetRemoteSchemasOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: UseQueryOptions<
    ExportMetadataResponse,
    unknown,
    RemoteSchemaInfo[]
  >;
}

/**
 * This hook is a wrapper around a fetch call that gets the remote schemas from the metadata.
 *
 * @param options - Options to use for the query.
 * @returns The result of the query.
 */
export default function useGetRemoteSchemas({
  queryOptions,
}: UseGetRemoteSchemasOptions = {}) {
  const { project, loading } = useProject();

  const query = useQuery<ExportMetadataResponse, unknown, RemoteSchemaInfo[]>(
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
      select: (data) => data.metadata?.remote_schemas ?? [],
    },
  );

  return query;
}
