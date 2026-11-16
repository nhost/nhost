import { isPlatform } from '@/utils/env';
import type { CustomFetchOptions } from '@/utils/hasura-api/customFetch';
import { customFetch } from '@/utils/hasura-api/customFetch';
import type {
  ErrorResponse,
  MetadataOperation,
  MetadataOperation200,
} from '@/utils/hasura-api/generated/schemas';
import { saveMetadata } from '@/utils/hasura-api/saveMetadata';

export interface MetadataFetchOptions extends CustomFetchOptions {
  appUrl: string;
}

export type MetadataOperationResponse =
  | { data: MetadataOperation200; status: 200; headers: Headers }
  | { data: ErrorResponse; status: 400; headers: Headers }
  | { data: { error?: string }; status: 401; headers: Headers }
  | { data: ErrorResponse; status: 500; headers: Headers };

/**
 * Sends a request to `/v1/metadata` and returns the response. It never saves to
 * the project's `nhost/metadata` files, so use it for reads, reloads, event and
 * scheduled-event runs, and the platform request of hooks that switch to a
 * `*Migration.ts` sibling for local projects. Other metadata writes use
 * `writeMetadata`.
 */
export function metadataOperation(
  operation: MetadataOperation,
  options: MetadataFetchOptions,
): Promise<MetadataOperationResponse> {
  const { appUrl, ...fetchOptions } = options;

  return customFetch<MetadataOperationResponse>(`${appUrl}/v1/metadata`, {
    ...fetchOptions,
    method: 'POST',
    body: JSON.stringify(operation),
  });
}

/**
 * Sends a metadata change to `/v1/metadata`. In local development, after a
 * successful write, it asks the CLI to save the running metadata to the
 * project's `nhost/metadata` files, so the change survives the next `nhost up`.
 * On the platform it is the same as `metadataOperation`.
 *
 * Use it for metadata writes that have no `*Migration.ts` sibling. If saving
 * fails, it throws an error saying the change was applied but not saved.
 */
export async function writeMetadata(
  operation: MetadataOperation,
  options: MetadataFetchOptions,
): Promise<MetadataOperationResponse> {
  const response = await metadataOperation(operation, options);
  if (response.status === 200 && !isPlatform()) {
    await saveMetadata(options.adminSecret);
  }
  return response;
}
