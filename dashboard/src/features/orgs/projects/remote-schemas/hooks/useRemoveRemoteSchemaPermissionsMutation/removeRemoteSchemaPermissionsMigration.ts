import type { RemoteSchemaPermissionsStepArgs } from '@/utils/hasura-api/generated/schemas';
import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export interface RemoveRemoteSchemaPermissionsMigrationVariables {
  args: RemoteSchemaPermissionsStepArgs;
}

export default async function removeRemoteSchemaPermissionsMigration({
  appUrl,
  adminSecret,
  args,
}: MigrationOperationOptions &
  RemoveRemoteSchemaPermissionsMigrationVariables) {
  try {
    const response = await executeMigration(
      {
        name: 'remove_remoteSchema_perm',
        up: [
          {
            type: 'drop_remote_schema_permissions',
            args: {
              remote_schema: args.remote_schema,
              role: args.role,
            },
          },
        ],
        down: args.definition?.schema
          ? [
              {
                type: 'add_remote_schema_permissions',
                args: {
                  remote_schema: args.remote_schema,
                  role: args.role,
                  definition: {
                    schema: args.definition!.schema,
                  },
                },
              },
            ]
          : [],
        datasource: 'default',
        skip_execution: false,
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
