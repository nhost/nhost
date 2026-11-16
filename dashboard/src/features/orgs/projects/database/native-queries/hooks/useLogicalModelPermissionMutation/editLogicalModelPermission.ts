import type { LogicalModelPermissionArgs } from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelPermissionMutation/types';
import { metadataOperation } from '@/utils/hasura-api/metadataFetch';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface EditLogicalModelPermissionVariables {
  source: string;
  resourceVersion: number;
  args: LogicalModelPermissionArgs;
}

export default async function editLogicalModelPermission({
  appUrl,
  adminSecret,
  source,
  resourceVersion,
  args,
}: MetadataOperationOptions & EditLogicalModelPermissionVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'bulk',
        resource_version: resourceVersion,
        args: [
          {
            type: 'pg_drop_logical_model_select_permission',
            args: { source, name: args.name, role: args.role },
          },
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
