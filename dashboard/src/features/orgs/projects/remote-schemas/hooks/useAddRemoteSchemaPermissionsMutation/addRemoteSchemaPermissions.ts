import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type { RemoteSchemaPermissionsStepArgs } from '@/utils/hasura-api/generated/schemas';

export interface AddRemoteSchemaPermissionsOptions {
  appUrl: string;
  adminSecret: string;
}

export interface AddRemoteSchemaPermissionsVariables {
  args: RemoteSchemaPermissionsStepArgs;
}

export default async function addRemoteSchemaPermissions({
  appUrl,
  adminSecret,
  args,
}: AddRemoteSchemaPermissionsOptions & AddRemoteSchemaPermissionsVariables) {
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
        up: args.definition.schema
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
