import { metadataOperation } from '@/utils/hasura-api/metadataFetch';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface DeleteLogicalModelPermissionVariables {
  source: string;
  resourceVersion: number;
  name: string;
  role: string;
}

export default async function deleteLogicalModelPermission({
  appUrl,
  adminSecret,
  source,
  resourceVersion,
  name,
  role,
}: MetadataOperationOptions & DeleteLogicalModelPermissionVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'bulk',
        resource_version: resourceVersion,
        args: [
          {
            type: 'pg_drop_logical_model_select_permission',
            args: { source, name, role },
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
