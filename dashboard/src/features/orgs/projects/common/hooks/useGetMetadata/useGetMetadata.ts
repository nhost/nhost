import { useExportMetadata } from '@/features/orgs/projects/common/hooks/useExportMetadata';

/**
 * This hook gets the metadata from the Hasura API.
 *
 * @returns The result of the query.
 */
export default function useGetMetadata() {
  return useExportMetadata((data) => data.metadata);
}
