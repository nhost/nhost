import { buildActionMigrationRequest } from '@/features/orgs/projects/actions/utils/buildActionMigrationRequest';
import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type {
  MigrationRequest,
  SetCustomTypesStep,
} from '@/utils/hasura-api/generated/schemas';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';
import type { SetCustomTypesVariables } from './setCustomTypes';

export function buildSetCustomTypesMigrationRequest({
  customTypes,
  previousCustomTypes,
}: SetCustomTypesVariables): MigrationRequest {
  const up = [
    {
      type: 'set_custom_types',
      args: customTypes,
    } satisfies SetCustomTypesStep,
  ];

  const down = [
    {
      type: 'set_custom_types',
      args: previousCustomTypes,
    } satisfies SetCustomTypesStep,
  ];

  return buildActionMigrationRequest('update_custom_types', { up, down });
}

export default async function setCustomTypesMigration({
  appUrl,
  adminSecret,
  ...variables
}: MigrationOperationOptions & SetCustomTypesVariables) {
  try {
    const response = await executeMigration(
      buildSetCustomTypesMigrationRequest(variables),
      {
        baseUrl: appUrl,
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
