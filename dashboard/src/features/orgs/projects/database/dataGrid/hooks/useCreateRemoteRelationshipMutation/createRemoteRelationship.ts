import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { CreateRemoteRelationshipArgs } from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface CreateRemoteRelationshipVariables {
  resourceVersion: number;
  args: CreateRemoteRelationshipArgs;
}

export default async function createRemoteRelationship({
  appUrl,
  adminSecret,
  resourceVersion,
  args,
}: MetadataOperationOptions & CreateRemoteRelationshipVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'bulk',
        resource_version: resourceVersion,
        args: [
          {
            type: 'pg_create_remote_relationship',
            args,
          },
        ],
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
