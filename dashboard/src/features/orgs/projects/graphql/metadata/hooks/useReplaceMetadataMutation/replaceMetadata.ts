import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  GetInconsistentMetadataResponse,
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
        version: 2,
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
      // It returns the same response as get inconsistent metadata, so we can reuse the same type
      return response.data as GetInconsistentMetadataResponse;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
