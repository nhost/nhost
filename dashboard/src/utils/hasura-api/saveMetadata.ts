import { getHasuraMigrationsApiUrl } from '@/utils/env';
import { customFetch } from '@/utils/hasura-api/customFetch';
import type {
  ErrorResponse,
  SaveMetadataResponse,
} from '@/utils/hasura-api/generated/schemas';

const METADATA_NOT_SAVED_MESSAGE =
  'The change was applied to the running project but could not be saved to nhost/metadata. The next nhost up or metadata apply will revert it. Reload before trying again, because creating the same object twice can fail.';

type SaveMetadataFetchResponse =
  | { data: SaveMetadataResponse; status: 200; headers: Headers }
  | { data: ErrorResponse; status: 500; headers: Headers };

/**
 * Asks the CLI to save the running metadata to the project's `nhost/metadata`
 * files. The CLI serves `/apis/metadata` next to the migrations API. If saving
 * fails, it throws an error saying the change was applied but not saved.
 */
export async function saveMetadata(adminSecret?: string): Promise<void> {
  let response: SaveMetadataFetchResponse;
  try {
    const url = new URL('metadata?export=true', getHasuraMigrationsApiUrl());
    response = await customFetch<SaveMetadataFetchResponse>(url.href, {
      adminSecret,
      method: 'GET',
    });
  } catch (error) {
    throw new Error(METADATA_NOT_SAVED_MESSAGE, { cause: error });
  }

  if (response.status !== 200) {
    throw new Error(
      [METADATA_NOT_SAVED_MESSAGE, response.data.message]
        .filter(Boolean)
        .join(' '),
    );
  }
}
