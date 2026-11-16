import type { RemoteSchemaPermissionsStepArgs } from '@/utils/hasura-api/generated/schemas';
import { metadataOperation } from '@/utils/hasura-api/metadataFetch';

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
