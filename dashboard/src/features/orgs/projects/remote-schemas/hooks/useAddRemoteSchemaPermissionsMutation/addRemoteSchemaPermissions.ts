import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { RemoteSchemaPermissionsStepArgs } from '@/utils/hasura-api/generated/schemas';

export interface AddRemoteSchemaPermissionsOptions {
  appUrl: string;
  adminSecret: string;
}

export interface AddRemoteSchemaPermissionsVariables {
  resourceVersion: number;
  args: Required<RemoteSchemaPermissionsStepArgs>;
}

export default async function addRemoteSchemaPermissions({
  appUrl,
  adminSecret,
  resourceVersion,
  args,
}: AddRemoteSchemaPermissionsOptions & AddRemoteSchemaPermissionsVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'bulk',
        source: 'default',
        resource_version: resourceVersion,
        args: [
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
