import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type {
  CreateFunctionPermissionArgs,
  DropFunctionPermissionArgs,
} from '@/utils/hasura-api/generated/schemas';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';
import type { FunctionPermissionOperationType } from './manageFunctionPermission';

const inverseOperation: Record<
  FunctionPermissionOperationType,
  FunctionPermissionOperationType
> = {
  pg_create_function_permission: 'pg_drop_function_permission',
  pg_drop_function_permission: 'pg_create_function_permission',
};

export interface ManageFunctionPermissionMigrationVariables {
  type: FunctionPermissionOperationType;
  args: CreateFunctionPermissionArgs | DropFunctionPermissionArgs;
  /**
   * Resource version is not used for migrations but is accepted for compatibility
   * with the platform version of the mutation variables.
   */
  resourceVersion?: number;
}

export default async function manageFunctionPermissionMigration({
  appUrl,
  adminSecret,
  type,
  args,
}: MigrationOperationOptions & ManageFunctionPermissionMigrationVariables) {
  const functionName = args.function.name;
  const functionSchema = args.function.schema;
  const { role } = args;
  const source = args.source ?? 'default';

  const stepArgs = {
    function: { schema: functionSchema, name: functionName },
    role,
    source,
  };

  try {
    const response = await executeMigration(
      {
        name: `${type}_role_${role}_function_${functionSchema}_${functionName}`,
        up: [{ type, args: stepArgs }],
        down: [{ type: inverseOperation[type], args: stepArgs }],
        datasource: source,
        skip_execution: false,
      },
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
