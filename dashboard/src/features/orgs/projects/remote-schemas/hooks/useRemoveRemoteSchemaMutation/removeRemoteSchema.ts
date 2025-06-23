import type { MetadataOperationOptions } from '@/features/orgs/projects/remote-schemas/types';
import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { RemoveRemoteSchemaArgs } from '@/utils/hasura-api/generated/schemas';

export interface RemoveRemoteSchemaVariables {
  args: RemoveRemoteSchemaArgs;
}

export default async function removeRemoteSchema({
  appUrl,
  adminSecret,
  args,
}: MetadataOperationOptions & RemoveRemoteSchemaVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'remove_remote_schema',
        args: {
          name: args.name,
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
