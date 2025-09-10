import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  RemoteSchemaInfo,
  UpdateRemoteSchemaBulkOperation,
} from '@/utils/hasura-api/generated/schemas';

export interface UpdateRemoteSchemaOptions {
  appUrl: string;
  adminSecret: string;
}

export interface UpdateRemoteSchemaVariables {
  updatedRemoteSchema: RemoteSchemaInfo;
  resourceVersion: number;
}

export default async function updateRemoteSchema({
  appUrl,
  adminSecret,
  updatedRemoteSchema,
  resourceVersion,
}: UpdateRemoteSchemaOptions & UpdateRemoteSchemaVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'bulk',
        source: 'default',
        resource_version: resourceVersion,
        args: [
          {
            type: 'update_remote_schema',
            args: {
              ...updatedRemoteSchema,
            },
          },
        ],
      } satisfies UpdateRemoteSchemaBulkOperation,
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
