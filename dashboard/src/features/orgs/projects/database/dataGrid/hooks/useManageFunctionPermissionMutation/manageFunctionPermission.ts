import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  CreateFunctionPermissionArgs,
  CreateFunctionPermissionBulkOperation,
  DropFunctionPermissionArgs,
  DropFunctionPermissionBulkOperation,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface ManageFunctionPermissionVariables {
  resourceVersion: number;
  type: 'create' | 'drop';
  args: CreateFunctionPermissionArgs | DropFunctionPermissionArgs;
}

export default async function manageFunctionPermission({
  appUrl,
  adminSecret,
  resourceVersion,
  type,
  args,
}: MetadataOperationOptions & ManageFunctionPermissionVariables) {
  const payload =
    type === 'create'
      ? ({
          type: 'bulk',
          source: 'default',
          resource_version: resourceVersion,
          args: [
            {
              type: 'pg_create_function_permission',
              args,
            },
          ],
        } satisfies CreateFunctionPermissionBulkOperation)
      : ({
          type: 'bulk',
          source: 'default',
          resource_version: resourceVersion,
          args: [
            {
              type: 'pg_drop_function_permission',
              args,
            },
          ],
        } satisfies DropFunctionPermissionBulkOperation);

  try {
    const response = await metadataOperation(payload, {
      baseUrl: appUrl,
      adminSecret,
    });

    if (response.status === 200) {
      return response.data;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
