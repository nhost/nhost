import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  ClearMetadataOperation,
  MetadataOperation200,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export default async function clearMetadata({
  appUrl,
  adminSecret,
}: MetadataOperationOptions) {
  try {
    const response = await metadataOperation(
      {
        type: 'clear_metadata',
        args: {},
      } satisfies ClearMetadataOperation,
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
