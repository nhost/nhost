import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type { RemoteSchemaPermissionsStepArgs } from '@/utils/hasura-api/generated/schemas';

export interface AddRemoteSchemaPermissionsMigrationOptions {
  appUrl: string;
  adminSecret: string;
}

export interface AddRemoteSchemaPermissionsMigrationVariables {
  args: RemoteSchemaPermissionsStepArgs;
}

export default async function addRemoteSchemaPermissionsMigration({
  appUrl,
  adminSecret,
  args,
}: AddRemoteSchemaPermissionsMigrationOptions &
  AddRemoteSchemaPermissionsMigrationVariables) {
  try {
    const response = await executeMigration(
      {
        name: 'save_remote_schema_permission',
        down: [
          {
            type: 'drop_remote_schema_permissions',
            args: {
              remote_schema: args.remote_schema,
              role: args.role,
            },
          },
        ],
        up: args.definition?.schema
          ? [
              {
                type: 'add_remote_schema_permissions',
                args: {
                  remote_schema: args.remote_schema,
                  role: args.role,
                  definition: {
                    schema: args.definition.schema,
                  },
                },
              },
            ]
          : [],
        datasource: 'default',
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
