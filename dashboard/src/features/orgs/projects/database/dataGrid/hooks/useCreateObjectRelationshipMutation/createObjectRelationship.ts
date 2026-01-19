import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { CreateLocalRelationshipArgs } from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface CreateObjectRelationshipVariables {
  resourceVersion: number;
  args: CreateLocalRelationshipArgs;
}

export default async function createObjectRelationship({
  appUrl,
  adminSecret,
  resourceVersion,
  args,
}: MetadataOperationOptions & CreateObjectRelationshipVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'bulk_atomic',
        resource_version: resourceVersion,
        args: [
          {
            type: 'pg_create_object_relationship',
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
