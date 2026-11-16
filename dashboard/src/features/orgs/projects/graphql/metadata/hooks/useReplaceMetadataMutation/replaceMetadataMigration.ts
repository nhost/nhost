import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export interface ReplaceMetadataMigrationVariables {
  oldMetadata: Record<string, unknown>;
  metadata: Record<string, unknown>;
  allowInconsistentMetadata: boolean;
}

export default async function replaceMetadataMigration({
  adminSecret,
  oldMetadata,
  metadata,
  allowInconsistentMetadata,
}: MigrationOperationOptions & ReplaceMetadataMigrationVariables) {
  try {
    const response = await executeMigration(
      {
        name: 'replace_metadata',
        down: [
          {
            type: 'replace_metadata',
            args: {
              metadata: oldMetadata,
              allow_inconsistent_metadata: allowInconsistentMetadata,
            },
          },
        ],
        up: [
          {
            type: 'replace_metadata',
            args: {
              metadata,
              allow_inconsistent_metadata: allowInconsistentMetadata,
            },
          },
        ],
        datasource: 'default',
        skip_execution: false,
      },
      {
        adminSecret,
      },
    );

    if (response.status === 200) {
      return response.data;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
