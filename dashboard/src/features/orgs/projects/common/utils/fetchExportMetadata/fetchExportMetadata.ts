import type { MetadataOperationOptions } from '@/features/orgs/projects/remote-schemas/types';
import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { ExportMetadataResponse } from '@/utils/hasura-api/generated/schemas';

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
