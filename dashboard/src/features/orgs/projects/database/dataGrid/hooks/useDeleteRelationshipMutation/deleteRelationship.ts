import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  DeleteRemoteRelationshipBulkOperation,
  DropRelationshipBulkOperation,
  QualifiedTable,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface DeleteRelationshipVariables {
  resourceVersion: number;
  args: {
    relationshipName: string;
    table: QualifiedTable;
    source: string;
  };
  type: 'local' | 'remote';
}

export default async function deleteRelationship({
  appUrl,
  adminSecret,
  resourceVersion,
  type,
  args,
}: MetadataOperationOptions & DeleteRelationshipVariables) {
  const { relationshipName, table, source } = args;
  const payload =
    type === 'local'
      ? ({
          type: 'bulk_atomic',
          resource_version: resourceVersion,
          args: [
            {
              type: 'pg_drop_relationship',
              args: {
                relationship: relationshipName,
                table,
                source,
              },
            },
          ],
        } satisfies DropRelationshipBulkOperation)
      : ({
          type: 'bulk_atomic',
          resource_version: resourceVersion,
          args: [
            {
              type: 'pg_delete_remote_relationship',
              args: {
                name: relationshipName,
                table,
                source,
              },
            },
          ],
        } satisfies DeleteRemoteRelationshipBulkOperation);
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
