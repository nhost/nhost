import type { RemoteSchemaInfo } from '@/utils/hasura-api/generated/schemas';
import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export interface RemoveRemoteSchemaMigrationVariables {
  remoteSchema: RemoteSchemaInfo;
}

export default async function removeRemoteSchemaMigration({
  adminSecret,
  remoteSchema,
}: MigrationOperationOptions & RemoveRemoteSchemaMigrationVariables) {
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
