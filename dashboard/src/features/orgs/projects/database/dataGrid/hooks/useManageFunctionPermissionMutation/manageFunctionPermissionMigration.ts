import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type {
  CreateFunctionPermissionArgs,
  DropFunctionPermissionArgs,
} from '@/utils/hasura-api/generated/schemas';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export interface ManageFunctionPermissionMigrationVariables {
  type: 'create' | 'drop';
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

  const migrationName =
    type === 'create'
      ? `set_permission_role_${role}_function_${functionSchema}_${functionName}`
      : `drop_permission_role_${role}_function_${functionSchema}_${functionName}`;

  const upStep =
    type === 'create'
      ? {
          type: 'pg_create_function_permission' as const,
          args: {
            function: {
              schema: functionSchema,
              name: functionName,
            },
            role,
            source,
          },
        }
      : {
          type: 'pg_drop_function_permission' as const,
          args: {
            function: {
              schema: functionSchema,
              name: functionName,
            },
            role,
            source,
          },
        };

  const downStep =
    type === 'create'
      ? {
          type: 'pg_drop_function_permission' as const,
          args: {
            function: {
              schema: functionSchema,
              name: functionName,
            },
            role,
            source,
          },
        }
      : {
          type: 'pg_create_function_permission' as const,
          args: {
            function: {
              schema: functionSchema,
              name: functionName,
            },
            role,
            source,
          },
        };

  try {
    const response = await executeMigration(
      {
        name: migrationName,
        up: [upStep],
        down: [downStep],
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
