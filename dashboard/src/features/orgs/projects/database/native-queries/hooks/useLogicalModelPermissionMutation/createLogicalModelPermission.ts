import type { LogicalModelPermissionArgs } from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelPermissionMutation/types';
import { metadataOperation } from '@/utils/hasura-api/metadataFetch';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface CreateLogicalModelPermissionVariables {
  source: string;
  resourceVersion: number;
  args: LogicalModelPermissionArgs;
}

export default async function createLogicalModelPermission({
  appUrl,
  adminSecret,
  source,
  resourceVersion,
  args,
}: MetadataOperationOptions & CreateLogicalModelPermissionVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'bulk',
        resource_version: resourceVersion,
        args: [
          {
            type: 'pg_create_logical_model_select_permission',
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
