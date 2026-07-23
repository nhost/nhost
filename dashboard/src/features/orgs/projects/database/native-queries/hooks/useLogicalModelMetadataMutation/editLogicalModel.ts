import executeLogicalModelMetadata from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation/executeLogicalModelMetadata';
import { buildEditLogicalModelSteps } from '@/features/orgs/projects/database/native-queries/utils/logicalModelOperations';
import type {
  LogicalModelItem,
  TrackLogicalModelArgs,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export default function editLogicalModel(
  options: MetadataOperationOptions & {
    resourceVersion: number;
    args: TrackLogicalModelArgs;
    original: LogicalModelItem;
  },
) {
  return executeLogicalModelMetadata(
    {
      type: 'bulk_atomic',
      resource_version: options.resourceVersion,
      args: buildEditLogicalModelSteps(options.args, options.original),
    },
    options,
  );
}
