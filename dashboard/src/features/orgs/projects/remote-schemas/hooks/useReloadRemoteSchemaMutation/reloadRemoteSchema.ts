import type { ReloadRemoteSchemaArgs } from '@/utils/hasura-api/generated/schemas';
import { metadataOperation } from '@/utils/hasura-api/metadataFetch';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface ReloadRemoteSchemaVariables {
  args: ReloadRemoteSchemaArgs;
}

export default async function reloadRemoteSchema({
  appUrl,
  adminSecret,
  args,
}: MetadataOperationOptions & ReloadRemoteSchemaVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'reload_remote_schema',
        args: {
          name: args.name,
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
