import { useExportMetadata } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import type {
  ExportMetadataResponse,
  LogicalModelItem,
} from '@/utils/hasura-api/generated/schemas';

export const selectLogicalModels = (
  data: ExportMetadataResponse,
  sourceName: string,
): LogicalModelItem[] =>
  data.metadata.sources?.find(
    (source) => source.name === sourceName && source.kind === 'postgres',
  )?.logical_models ?? [];

export default function useGetLogicalModels(source: string) {
  return useExportMetadata((data) => selectLogicalModels(data, source));
}
