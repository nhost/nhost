import { useExportMetadata } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import type { ExportMetadataResponse } from '@/utils/hasura-api/generated/schemas';

export const selectSupportedNativeQuerySources = (
  data: ExportMetadataResponse,
): string[] =>
  data.metadata.sources?.flatMap((source) =>
    source.kind === 'postgres' && source.name ? [source.name] : [],
  ) ?? [];

export default function useGetSupportedNativeQuerySources() {
  return useExportMetadata(selectSupportedNativeQuerySources);
}
