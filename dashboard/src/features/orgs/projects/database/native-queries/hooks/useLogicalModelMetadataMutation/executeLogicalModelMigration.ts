import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type { MigrationRequest } from '@/utils/hasura-api/generated/schemas';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export default async function executeLogicalModelMigration(
  migration: MigrationRequest,
  options: MigrationOperationOptions,
) {
  const response = await executeMigration(migration, {
    baseUrl: options.appUrl,
    adminSecret: options.adminSecret,
  });

  if (response.status === 200) {
    return response.data;
  }

  throw new Error(response.data.error);
}
