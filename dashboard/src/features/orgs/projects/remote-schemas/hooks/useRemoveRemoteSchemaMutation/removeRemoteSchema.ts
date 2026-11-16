import type { RemoteSchemaInfo } from '@/utils/hasura-api/generated/schemas';
import { metadataOperation } from '@/utils/hasura-api/metadataFetch';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface RemoveRemoteSchemaVariables {
  remoteSchema: RemoteSchemaInfo;
}

export default async function removeRemoteSchema({
  appUrl,
  adminSecret,
  remoteSchema,
}: MetadataOperationOptions & RemoveRemoteSchemaVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'remove_remote_schema',
        args: {
          name: remoteSchema.name,
        },
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
