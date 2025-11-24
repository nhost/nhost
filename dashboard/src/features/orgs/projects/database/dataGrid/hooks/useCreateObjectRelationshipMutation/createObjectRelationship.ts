import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { CreateObjectRelationshipArgs } from '@/utils/hasura-api/generated/schemas';

export interface CreateObjectRelationshipOptions {
  appUrl: string;
  adminSecret: string;
}

export interface CreateObjectRelationshipVariables {
  resourceVersion: number;
  args: CreateObjectRelationshipArgs;
}

export default async function createObjectRelationship({
  appUrl,
  adminSecret,
  resourceVersion,
  args,
}: CreateObjectRelationshipOptions & CreateObjectRelationshipVariables) {
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
