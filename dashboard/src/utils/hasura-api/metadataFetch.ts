import type { CustomFetchOptions } from '@/utils/hasura-api/customFetch';
import { customFetch } from '@/utils/hasura-api/customFetch';
import type {
  ErrorResponse,
  MetadataOperation,
  MetadataOperation200,
} from '@/utils/hasura-api/generated/schemas';
import {
  classifyMetadataVersionConflictResponse,
  MetadataVersionConflictError,
} from '@/utils/hasura-api/metadata-version-conflict-error';

export interface MetadataFetchOptions extends CustomFetchOptions {
  appUrl: string;
}

export type MetadataOperationResponse =
  | { data: MetadataOperation200; status: 200; headers: Headers }
  | { data: ErrorResponse; status: 400; headers: Headers }
  | { data: { error?: string }; status: 401; headers: Headers }
  | { data: ErrorResponse; status: 409; headers: Headers }
  | { data: ErrorResponse; status: 500; headers: Headers };

export async function metadataOperation(
  operation: MetadataOperation,
  options: MetadataFetchOptions,
): Promise<MetadataOperationResponse> {
  const { appUrl, ...fetchOptions } = options;

  const response = await customFetch<MetadataOperationResponse>(
    `${appUrl}/v1/metadata`,
    {
      ...fetchOptions,
      method: 'POST',
      body: JSON.stringify(operation),
    },
  );
  const conflict = classifyMetadataVersionConflictResponse(response);

  if (conflict) {
    throw new MetadataVersionConflictError(conflict.message, appUrl);
  }

  return response;
}
