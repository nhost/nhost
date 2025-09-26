import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import { type RemoteSchemaPermissionsStepArgs } from '@/utils/hasura-api/generated/schemas';

export interface RemoveRemoteSchemaPermissionsOptions {
  appUrl: string;
  adminSecret: string;
}

export interface RemoveRemoteSchemaPermissionsVariables {
  resourceVersion: number;
  args: RemoteSchemaPermissionsStepArgs;
}

export default async function removeRemoteSchemaPermissions({
  appUrl,
  adminSecret,
  resourceVersion,
  args,
}: RemoveRemoteSchemaPermissionsOptions &
  RemoveRemoteSchemaPermissionsVariables) {
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
              remote_schema: args.remote_schema,
              role: args.role,
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
