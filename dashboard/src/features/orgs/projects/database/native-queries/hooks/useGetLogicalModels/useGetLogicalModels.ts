import { useExportMetadata } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import type {
  ExportMetadataResponse,
  LogicalModelItem,
} from '@/utils/hasura-api/generated/schemas';

export const selectLogicalModels = (
  data: ExportMetadataResponse,
): LogicalModelItem[] =>
  data.metadata.sources?.find((source) => source.name === 'default')
    ?.logical_models ?? [];

export default function useGetLogicalModels() {
  return useExportMetadata(selectLogicalModels);
}
