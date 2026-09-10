import { getHasuraMigrationsApiUrl } from '@/utils/env';
import type { CustomFetchOptions } from '@/utils/hasura-api/customFetch';
import { customFetch } from '@/utils/hasura-api/customFetch';
import type {
  ErrorResponse,
  MigrationRequest,
  SuccessResponse,
} from '@/utils/hasura-api/generated/schemas';
import {
  classifyMigrationMetadataVersionConflictResponse,
  MetadataVersionConflictError,
} from '@/utils/hasura-api/metadata-version-conflict-error';

export interface ExecuteMigrationOptions extends CustomFetchOptions {
  appUrl: string;
}

export type ExecuteMigrationResponse =
  | { data: SuccessResponse; status: 200; headers: Headers }
  | { data: ErrorResponse; status: 400; headers: Headers }
  | { data: ErrorResponse; status: 500; headers: Headers };

export async function executeMigration(
  migrationRequest: MigrationRequest,
  options: ExecuteMigrationOptions,
): Promise<ExecuteMigrationResponse> {
  const { appUrl, ...fetchOptions } = options;
  const response = await customFetch<ExecuteMigrationResponse>(
    getHasuraMigrationsApiUrl(),
    {
      ...fetchOptions,
      method: 'POST',
      body: JSON.stringify(migrationRequest),
    },
  );
  const conflict = classifyMigrationMetadataVersionConflictResponse(response);

  if (conflict) {
    throw new MetadataVersionConflictError(conflict.message, appUrl);
  }

  return response;
}
