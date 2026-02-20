import { useExportMetadata } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import type { RemoteSchemaInfo } from '@/utils/hasura-api/generated/schemas';

/**
 * This hook is a wrapper around a fetch call that gets the remote schemas from the metadata.
 *
 * @returns The result of the query.
 */
export default function useGetRemoteSchemas() {
  return useExportMetadata(
    (data): RemoteSchemaInfo[] => data.metadata?.remote_schemas ?? [],
  );
}
