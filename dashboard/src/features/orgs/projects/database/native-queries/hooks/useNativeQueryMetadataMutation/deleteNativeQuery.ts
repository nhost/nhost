import type { NativeQueryItem } from '@/utils/hasura-api/generated/schemas';
import { metadataOperation } from '@/utils/hasura-api/metadataFetch';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface DeleteNativeQueryVariables {
  resourceVersion: number;
  source: string;
  original: NativeQueryItem;
}

export default async function deleteNativeQuery({
  appUrl,
  adminSecret,
  resourceVersion,
  source,
  original,
}: MetadataOperationOptions & DeleteNativeQueryVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'bulk_atomic',
        resource_version: resourceVersion,
        args: [
          {
            type: 'pg_untrack_native_query',
            args: {
              source,
              root_field_name: original.root_field_name,
            },
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
