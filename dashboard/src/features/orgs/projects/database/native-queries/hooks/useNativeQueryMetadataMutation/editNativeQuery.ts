import type { NativeQueryMutationArgs } from '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation/types';
import type { NativeQueryItem } from '@/utils/hasura-api/generated/schemas';
import { metadataOperation } from '@/utils/hasura-api/metadataFetch';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';
import buildTrackNativeQueryStep from './buildTrackNativeQueryStep';

export interface EditNativeQueryVariables {
  resourceVersion: number;
  source: string;
  args: NativeQueryMutationArgs;
  original: NativeQueryItem;
}

export default async function editNativeQuery({
  appUrl,
  adminSecret,
  resourceVersion,
  source,
  args,
  original,
}: MetadataOperationOptions & EditNativeQueryVariables) {
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
          buildTrackNativeQueryStep(source, args),
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
