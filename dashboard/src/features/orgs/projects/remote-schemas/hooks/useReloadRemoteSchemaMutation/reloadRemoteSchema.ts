import type { MetadataOperationOptions } from '@/features/orgs/projects/remote-schemas/types';
import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { ReloadRemoteSchemaArgs } from '@/utils/hasura-api/generated/schemas';

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
        baseUrl: appUrl,
        adminSecret,
      },
    );

    if (response.status === 200) {
      return response.data;
    }

    throw new Error(response.data.message);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
