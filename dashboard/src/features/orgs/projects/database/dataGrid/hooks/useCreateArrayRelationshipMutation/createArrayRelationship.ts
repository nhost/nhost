import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { CreateArrayRelationshipArgs } from '@/utils/hasura-api/generated/schemas';

export interface CreateArrayRelationshipOptions {
  appUrl: string;
  adminSecret: string;
}

export interface CreateArrayRelationshipVariables {
  resourceVersion: number;
  args: CreateArrayRelationshipArgs;
}

export default async function createArrayRelationship({
  appUrl,
  adminSecret,
  resourceVersion,
  args,
}: CreateArrayRelationshipOptions & CreateArrayRelationshipVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'bulk_atomic',
        resource_version: resourceVersion,
        args: [
          {
            type: 'pg_create_array_relationship',
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
