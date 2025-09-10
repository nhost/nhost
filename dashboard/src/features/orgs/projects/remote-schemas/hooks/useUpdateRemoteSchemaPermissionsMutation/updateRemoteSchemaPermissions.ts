import { metadataOperation } from '@/utils/hasura-api/generated/default/default';

export interface UpdateRemoteSchemaPermissionsOptions {
  appUrl: string;
  adminSecret: string;
}

export interface UpdateRemoteSchemaPermissionsVariables {
  role: string;
  newPermissionSchema: string;
  remoteSchema: string;
  resourceVersion: number;
}

export default async function updateRemoteSchemaPermissions({
  appUrl,
  adminSecret,
  role,
  newPermissionSchema,
  resourceVersion,
  remoteSchema,
}: UpdateRemoteSchemaPermissionsOptions &
  UpdateRemoteSchemaPermissionsVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'bulk',
        source: 'default',
        resource_version: resourceVersion,
        args: [
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
        ],
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
