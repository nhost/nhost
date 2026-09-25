import { useExportMetadata } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import type {
  ExportMetadataResponse,
  NativeQueryItem,
} from '@/utils/hasura-api/generated/schemas';

function selectNativeQueries(data: ExportMetadataResponse): NativeQueryItem[] {
  return (
    data.metadata.sources?.find((source) => source.name === 'default')
      ?.native_queries ?? []
  );
}

export default function useGetNativeQueries() {
  return useExportMetadata(selectNativeQueries);
}
