import { executeMigration } from '@/utils/hasura-api/generated/default/default';

export interface UpdateRemoteSchemaPermissionsMigrationOptions {
  appUrl: string;
  adminSecret: string;
}

export interface UpdateRemoteSchemaPermissionsMigrationVariables {
  role: string;
  originalPermissionSchema: string;
  newPermissionSchema: string;
  remoteSchema: string;
}

export default async function updateRemoteSchemaPermissionsMigration({
  appUrl,
  adminSecret,
  role,
  originalPermissionSchema,
  newPermissionSchema,
  remoteSchema,
}: UpdateRemoteSchemaPermissionsMigrationOptions &
  UpdateRemoteSchemaPermissionsMigrationVariables) {
  try {
    const response = await executeMigration(
      {
        name: 'save_remote_schema_permission',
        down: originalPermissionSchema
          ? [
              {
                type: 'add_remote_schema_permissions',
                args: {
                  remote_schema: remoteSchema,
                  role,
                  definition: {
                    schema: originalPermissionSchema,
                  },
                },
              },
              {
                type: 'drop_remote_schema_permissions',
                args: {
                  remote_schema: remoteSchema,
                  role,
                },
              },
            ]
          : [],
        up: newPermissionSchema
          ? [
              {
                type: 'drop_remote_schema_permissions',
                args: {
                  remote_schema: remoteSchema,
                  role,
                },
              },
              {
                type: 'add_remote_schema_permissions',
                args: {
                  remote_schema: remoteSchema,
                  role,
                  definition: {
                    schema: newPermissionSchema,
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
