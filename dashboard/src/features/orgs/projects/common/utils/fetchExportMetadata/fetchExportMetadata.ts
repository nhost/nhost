import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { ExportMetadataResponse } from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export default async function fetchExportMetadata({
  appUrl,
  adminSecret,
}: MetadataOperationOptions): Promise<ExportMetadataResponse> {
  try {
    const response = await metadataOperation(
      {
        type: 'export_metadata',
        version: 2,
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

    return response.data as ExportMetadataResponse;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
