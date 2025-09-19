import type { MetadataOperationOptions } from '@/features/orgs/projects/remote-schemas/types';
import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { RemoteSchemaInfo } from '@/utils/hasura-api/generated/schemas';

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
