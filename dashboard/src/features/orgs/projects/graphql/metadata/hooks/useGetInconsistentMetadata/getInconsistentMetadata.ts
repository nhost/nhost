import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { InconsistentMetadataResponse } from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export default async function getInconsistentMetadata({
  appUrl,
  adminSecret,
}: MetadataOperationOptions): Promise<InconsistentMetadataResponse> {
  try {
    const response = await metadataOperation(
      {
        type: 'get_inconsistent_metadata',
        args: {},
      },
      {
        baseUrl: appUrl,
        adminSecret,
      },
    );

    if (response.status !== 200) {
      throw new Error(response.data.error);
    }

    return response.data as InconsistentMetadataResponse;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
