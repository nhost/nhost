import { useExportMetadata } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import type {
  ExportMetadataResponse,
  NativeQueryItem,
} from '@/utils/hasura-api/generated/schemas';

export const selectNativeQueries = (
  data: ExportMetadataResponse,
  sourceName: string,
): NativeQueryItem[] =>
  data.metadata.sources?.find(
    (source) => source.name === sourceName && source.kind === 'postgres',
  )?.native_queries ?? [];

export default function useGetNativeQueries(source: string) {
  return useExportMetadata((data) => selectNativeQueries(data, source));
}
