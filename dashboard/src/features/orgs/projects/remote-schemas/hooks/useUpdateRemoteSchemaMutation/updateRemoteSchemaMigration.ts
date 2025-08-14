import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type {
  RemoteSchemaInfo,
  UpdateRemoteSchemaArgs,
} from '@/utils/hasura-api/generated/schemas';

export interface UpdateRemoteSchemaMigrationOptions {
  appUrl: string;
  adminSecret: string;
}

export interface UpdateRemoteSchemaMigrationVariables {
  originalRemoteSchema: RemoteSchemaInfo;
  updatedRemoteSchema: UpdateRemoteSchemaArgs;
}

export default async function updateRemoteSchemaMigration({
  appUrl,
  adminSecret,
  originalRemoteSchema,
  updatedRemoteSchema,
}: UpdateRemoteSchemaMigrationOptions & UpdateRemoteSchemaMigrationVariables) {
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
        datasource: 'default', // TODO: Make this dynamic
      },
      {
        baseUrl: appUrl,
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
