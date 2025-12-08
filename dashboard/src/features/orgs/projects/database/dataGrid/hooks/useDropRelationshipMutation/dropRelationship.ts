import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { DropRelationshipStepArgs } from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface DropRelationshipVariables {
  resourceVersion: number;
  args: DropRelationshipStepArgs;
}

export default async function dropRelationship({
  appUrl,
  adminSecret,
  resourceVersion,
  args,
}: MetadataOperationOptions & DropRelationshipVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'bulk_atomic',
        resource_version: resourceVersion,
        args: [
          {
            type: 'pg_drop_relationship',
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
