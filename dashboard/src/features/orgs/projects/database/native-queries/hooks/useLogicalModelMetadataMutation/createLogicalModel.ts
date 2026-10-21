import type { LogicalModelMutationArgs } from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation/types';
import { metadataOperation } from '@/utils/hasura-api/metadataFetch';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface CreateLogicalModelVariables {
  resourceVersion: number;
  source: string;
  args: LogicalModelMutationArgs;
}

export default async function createLogicalModel({
  appUrl,
  adminSecret,
  resourceVersion,
  source,
  args,
}: MetadataOperationOptions & CreateLogicalModelVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'bulk_atomic',
        resource_version: resourceVersion,
        args: [
          {
            type: 'pg_track_logical_model',
            args: { ...args, source },
          },
        ],
      },
      {
        appUrl,
        adminSecret,
      },
    );

    if (response.status === 200) {
      return response.data;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
