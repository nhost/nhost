import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { NativeQueryMetadataBulkOperation } from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export default async function executeLogicalModelMetadata(
  operation: NativeQueryMetadataBulkOperation,
  options: MetadataOperationOptions,
) {
  const response = await metadataOperation(operation, {
    baseUrl: options.appUrl,
    adminSecret: options.adminSecret,
  });

  if (response.status === 200) {
    return response.data;
  }

  throw new Error(response.data.error);
}
