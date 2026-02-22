import { useExportMetadata } from '@/features/orgs/projects/common/hooks/useExportMetadata';

/**
 * This hook is a wrapper around a fetch call that gets the metadata resource version.
 *
 * @returns The result of the query.
 */
export default function useGetMetadataResourceVersion() {
  return useExportMetadata((data) => data.resource_version);
}
