import { getHasuraMigrationsApiUrl } from '@/utils/env';
import type { CustomFetchOptions } from '@/utils/hasura-api/customFetch';
import { customFetch } from '@/utils/hasura-api/customFetch';
import type {
  ErrorResponse,
  MigrationRequest,
  SuccessResponse,
} from '@/utils/hasura-api/generated/schemas';

export type ExecuteMigrationResponse =
  | { data: SuccessResponse; status: 200; headers: Headers }
  | { data: ErrorResponse; status: 500; headers: Headers };

export function executeMigration(
  migrationRequest: MigrationRequest,
  options?: CustomFetchOptions,
): Promise<ExecuteMigrationResponse> {
  return customFetch<ExecuteMigrationResponse>(getHasuraMigrationsApiUrl(), {
    ...options,
    method: 'POST',
    body: JSON.stringify(migrationRequest),
  });
}
