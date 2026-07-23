import { buildTrackStep } from '@/features/orgs/projects/database/native-queries/utils/logicalModelOperations';
import type { TrackLogicalModelArgs } from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';
import executeLogicalModelMetadata from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation/executeLogicalModelMetadata';

export default function createLogicalModel(
  options: MetadataOperationOptions & {
    resourceVersion: number;
    args: TrackLogicalModelArgs;
  },
) {
  return executeLogicalModelMetadata(
    {
      type: 'bulk_atomic',
      resource_version: options.resourceVersion,
      args: [buildTrackStep(options.args)],
    },
    options,
  );
}
