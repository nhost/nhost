import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type { RemoteSchemaInfo } from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface RemoveRemoteSchemaMigrationVariables {
  remoteSchema: RemoteSchemaInfo;
}

export default async function removeRemoteSchemaMigration({
  appUrl,
  adminSecret,
  remoteSchema,
}: MetadataOperationOptions & RemoveRemoteSchemaMigrationVariables) {
  try {
    const response = await executeMigration(
      {
        name: `remove_remote_schema${remoteSchema.name}`,
        up: [
          {
            type: 'remove_remote_schema',
            args: {
              name: remoteSchema.name,
            },
          },
        ],
        down: [
          {
            type: 'add_remote_schema',
            args: remoteSchema,
          },
        ],
        datasource: 'default',
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
