import type {
  MetadataOperation,
  MetadataOperation200,
} from '@/utils/hasura-api/generated/schemas';
import { exportLocalMetadata } from '@/utils/hasura-api/metadataExportFetch';
import { metadataOperation } from '@/utils/hasura-api/metadataFetch';

const LOCAL_METADATA_PERSISTENCE_ERROR_MESSAGE =
  'Hasura metadata was updated, but it could not be saved to local metadata files.';

export class LocalMetadataPersistenceError extends Error {
  constructor(cause: unknown) {
    super(LOCAL_METADATA_PERSISTENCE_ERROR_MESSAGE, { cause });
    this.name = 'LocalMetadataPersistenceError';
  }
}

export interface ExecuteMetadataMutationOptions {
  appUrl: string;
  adminSecret: string;
  isPlatform: boolean;
  onPartialSuccess: () => Promise<unknown>;
}

export default async function executeMetadataMutation(
  operation: MetadataOperation,
  {
    appUrl,
    adminSecret,
    isPlatform,
    onPartialSuccess,
  }: ExecuteMetadataMutationOptions,
): Promise<MetadataOperation200> {
  const response = await metadataOperation(operation, {
    appUrl,
    adminSecret,
  });

  if (response.status !== 200) {
    throw new Error(response.data.error);
  }

  if (isPlatform) {
    return response.data;
  }

  try {
    await exportLocalMetadata({ adminSecret });
  } catch (cause) {
    const persistenceError = new LocalMetadataPersistenceError(cause);

    try {
      await onPartialSuccess();
    } catch {
      // The persistence failure remains the actionable result even if refresh fails.
    }

    throw persistenceError;
  }

  return response.data;
}
