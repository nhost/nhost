import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  DropInconsistentMetadataOperation,
  MetadataOperation200,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export default async function dropInconsistentMetadata({
  appUrl,
  adminSecret,
}: MetadataOperationOptions) {
  try {
    const response = await metadataOperation(
      {
        type: 'drop_inconsistent_metadata',
        args: {},
      } satisfies DropInconsistentMetadataOperation,
      {
        baseUrl: appUrl,
        adminSecret,
      },
    );

    if (response.status === 200) {
      return response.data as MetadataOperation200;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
