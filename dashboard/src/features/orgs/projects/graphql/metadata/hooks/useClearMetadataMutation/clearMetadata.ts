import type {
  ClearMetadataOperation,
  MetadataOperation200,
} from '@/utils/hasura-api/generated/schemas';
import { writeMetadata } from '@/utils/hasura-api/metadataFetch';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export default async function clearMetadata({
  appUrl,
  adminSecret,
}: MetadataOperationOptions) {
  try {
    const response = await writeMetadata(
      {
        type: 'clear_metadata',
        args: {},
      } satisfies ClearMetadataOperation,
      {
        appUrl,
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
