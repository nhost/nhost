import type { NativeQueryMutationArgs } from '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation/types';
import { metadataOperation } from '@/utils/hasura-api/metadataFetch';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';
import buildTrackNativeQueryStep from './buildTrackNativeQueryStep';

export interface CreateNativeQueryVariables {
  resourceVersion: number;
  source: string;
  args: NativeQueryMutationArgs;
}

export default async function createNativeQuery({
  appUrl,
  adminSecret,
  resourceVersion,
  source,
  args,
}: MetadataOperationOptions & CreateNativeQueryVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'bulk_atomic',
        resource_version: resourceVersion,
        args: [buildTrackNativeQueryStep(source, args)],
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
