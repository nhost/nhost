import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  CreateFunctionPermissionArgs,
  CreateFunctionPermissionBulkOperation,
  DropFunctionPermissionArgs,
  DropFunctionPermissionBulkOperation,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export type FunctionPermissionOperationType =
  | 'pg_create_function_permission'
  | 'pg_drop_function_permission';

export interface ManageFunctionPermissionVariables {
  resourceVersion: number;
  type: FunctionPermissionOperationType;
  args: CreateFunctionPermissionArgs | DropFunctionPermissionArgs;
}

export default async function manageFunctionPermission({
  appUrl,
  adminSecret,
  resourceVersion,
  type,
  args,
}: MetadataOperationOptions & ManageFunctionPermissionVariables) {
  const source = args.source ?? 'default';

  try {
    const response = await metadataOperation(
      {
        type: 'bulk',
        source,
        resource_version: resourceVersion,
        args: [{ type, args }],
      } as
        | CreateFunctionPermissionBulkOperation
        | DropFunctionPermissionBulkOperation,
      {
        baseUrl: appUrl,
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
