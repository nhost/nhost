import executeLogicalModelMetadata from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation/executeLogicalModelMetadata';
import { buildUntrackStep } from '@/features/orgs/projects/database/native-queries/utils/logicalModelOperations';
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export default function deleteLogicalModel(
  options: MetadataOperationOptions & {
    resourceVersion: number;
    original: LogicalModelItem;
  },
) {
  return executeLogicalModelMetadata(
    {
      type: 'bulk_atomic',
      resource_version: options.resourceVersion,
      args: [buildUntrackStep(options.original.name)],
    },
    options,
  );
}
