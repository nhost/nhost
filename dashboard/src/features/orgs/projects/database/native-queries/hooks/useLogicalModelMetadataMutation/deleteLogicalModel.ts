import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';
import { metadataOperation } from '@/utils/hasura-api/metadataFetch';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface DeleteLogicalModelVariables {
  resourceVersion: number;
  source: string;
  original: LogicalModelItem;
}

export default async function deleteLogicalModel({
  appUrl,
  adminSecret,
  resourceVersion,
  source,
  original,
}: MetadataOperationOptions & DeleteLogicalModelVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'bulk_atomic',
        resource_version: resourceVersion,
        args: [
          {
            type: 'pg_untrack_logical_model',
            args: { source, name: original.name },
          },
        ],
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
