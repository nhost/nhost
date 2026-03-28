import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  CreateArrayRelationshipBulkOperation,
  CreateLocalRelationshipArgs,
  CreateObjectRelationshipBulkOperation,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface CreateRelationshipVariables {
  resourceVersion: number;
  args: CreateLocalRelationshipArgs;
  type: 'pg_create_object_relationship' | 'pg_create_array_relationship';
}

export default async function createRelationship({
  appUrl,
  adminSecret,
  resourceVersion,
  type,
  args,
}: MetadataOperationOptions & CreateRelationshipVariables) {
  const payload =
    type === 'pg_create_object_relationship'
      ? ({
          type: 'bulk_atomic',
          resource_version: resourceVersion,
          args: [
            {
              type: 'pg_create_object_relationship',
              args,
            },
          ],
        } satisfies CreateObjectRelationshipBulkOperation)
      : ({
          type: 'bulk_atomic',
          resource_version: resourceVersion,
          args: [
            {
              type: 'pg_create_array_relationship',
              args,
            },
          ],
        } satisfies CreateArrayRelationshipBulkOperation);

  try {
    const response = await metadataOperation(payload, {
      baseUrl: appUrl,
      adminSecret,
    });

    if (response.status === 200) {
      return response.data;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
