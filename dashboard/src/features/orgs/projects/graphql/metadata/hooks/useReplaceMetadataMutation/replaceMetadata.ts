import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  InconsistentMetadataResponse,
  ReplaceMetadataOperation,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface ReplaceMetadataVariables {
  metadata: Record<string, unknown>;
  allowInconsistentMetadata: boolean;
}

export default async function replaceMetadata({
  appUrl,
  adminSecret,
  metadata,
  allowInconsistentMetadata,
}: MetadataOperationOptions & ReplaceMetadataVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'replace_metadata',
        args: {
          allow_inconsistent_metadata: allowInconsistentMetadata,
          metadata,
        },
      } satisfies ReplaceMetadataOperation,
      {
        baseUrl: appUrl,
        adminSecret,
      },
    );

    if (response.status === 200) {
      return response.data as InconsistentMetadataResponse;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
