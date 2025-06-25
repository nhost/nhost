import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type { RemoteSchemaPermissionsStepArgs } from '@/utils/hasura-api/generated/schemas';

export interface RemoveRemoteSchemaPermissionsOptions {
  appUrl: string;
  adminSecret: string;
}

export interface RemoveRemoteSchemaPermissionsVariables {
  args: RemoteSchemaPermissionsStepArgs;
}

export default async function removeRemoteSchemaPermissions({
  appUrl,
  adminSecret,
  args,
}: RemoveRemoteSchemaPermissionsOptions &
  RemoveRemoteSchemaPermissionsVariables) {
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
        down: args.definition.schema
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
        datasource: 'default', // TODO: Make this dynamic
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
