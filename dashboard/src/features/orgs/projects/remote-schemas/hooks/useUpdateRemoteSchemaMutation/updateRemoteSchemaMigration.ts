import type { RemoteSchemaInfo } from '@/utils/hasura-api/generated/schemas';
import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export interface UpdateRemoteSchemaMigrationVariables {
  originalRemoteSchema: RemoteSchemaInfo;
  updatedRemoteSchema: RemoteSchemaInfo;
}

export default async function updateRemoteSchemaMigration({
  appUrl,
  adminSecret,
  originalRemoteSchema,
  updatedRemoteSchema,
}: MigrationOperationOptions & UpdateRemoteSchemaMigrationVariables) {
  try {
    const response = await executeMigration(
      {
        name: `update_remote_schema_${updatedRemoteSchema.name}`,
        up: [
          {
            type: 'update_remote_schema',
            args: updatedRemoteSchema,
          },
        ],
        down: [
          {
            type: 'update_remote_schema',
            args: originalRemoteSchema,
          },
        ],
        datasource: 'default',
      },
      {
        appUrl,
        adminSecret,
      },
    );

    if (response.status === 200) {
      return response.data;
    }

    throw new Error(response.data?.message ?? 'Unknown error');
  } catch (error) {
    console.error(error);
    throw error;
  }
}
