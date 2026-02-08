import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  ReloadMetadaOperationResponse,
  ReloadMetadataOperation,
  ReloadMetadataOperationArgs,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface ReloadMetadataVariables {
  args: ReloadMetadataOperationArgs;
}

export default async function reloadMetadata({
  appUrl,
  adminSecret,
  args,
}: MetadataOperationOptions & ReloadMetadataVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'reload_metadata',
        args,
      } satisfies ReloadMetadataOperation,
      {
        baseUrl: appUrl,
        adminSecret,
      },
    );

    if (response.status === 200) {
      return response.data as ReloadMetadaOperationResponse;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
