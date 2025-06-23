import type { MetadataOperationOptions } from '@/features/orgs/projects/remote-schemas/types';
import { isRemoteSchemaInfo } from '@/features/orgs/projects/remote-schemas/utils/guards';
import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  ExportMetadataResponse,
  RemoteSchemaInfo,
} from '@/utils/hasura-api/generated/schemas';

export default async function getRemoteSchemas({
  appUrl,
  adminSecret,
}: MetadataOperationOptions): Promise<RemoteSchemaInfo[]> {
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

    if (response.status === 200) {
      const data = response.data as ExportMetadataResponse;

      // Extract remote schemas from the metadata
      const remoteSchemas = data.metadata?.remote_schemas || [];

      // Filter and validate remote schemas using the type guard
      const validRemoteSchemas = remoteSchemas.filter(isRemoteSchemaInfo);

      return validRemoteSchemas;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
