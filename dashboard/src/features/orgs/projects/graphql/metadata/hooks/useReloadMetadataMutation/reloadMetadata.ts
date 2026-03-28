import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  ReloadMetadataOperation,
  ReloadMetadataOperationArgs,
  ReloadMetadataOperationResponse,
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
        args: {
          reload_remote_schema: args.reload_remote_schema || [],
          reload_sources: args.reload_sources || [],
        },
      } satisfies ReloadMetadataOperation,
      {
        baseUrl: appUrl,
        adminSecret,
      },
    );

    if (response.status === 200) {
      return response.data as ReloadMetadataOperationResponse;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
