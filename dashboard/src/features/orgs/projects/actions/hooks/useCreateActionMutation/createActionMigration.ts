import { buildActionMigrationRequest } from '@/features/orgs/projects/actions/utils/buildActionMigrationRequest';
import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type {
  CreateActionStep,
  DropActionOperation,
  MigrationRequest,
  SetCustomTypesStep,
} from '@/utils/hasura-api/generated/schemas';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';
import type { CreateActionVariables } from './createAction';

export function buildCreateActionMigrationRequest({
  args,
  customTypes,
  previousCustomTypes,
}: CreateActionVariables): MigrationRequest {
  const up = [
    {
      type: 'set_custom_types',
      args: customTypes,
    } satisfies SetCustomTypesStep,
    {
      type: 'create_action',
      args,
    } satisfies CreateActionStep,
  ];

  const down = [
    {
      type: 'drop_action',
      args: { name: args.name },
    } satisfies DropActionOperation,
    {
      type: 'set_custom_types',
      args: previousCustomTypes,
    } satisfies SetCustomTypesStep,
  ];

  return buildActionMigrationRequest(`create_action_${args.name}`, {
    up,
    down,
  });
}

export default async function createActionMigration({
  appUrl,
  adminSecret,
  ...variables
}: MigrationOperationOptions & CreateActionVariables) {
  try {
    const response = await executeMigration(
      buildCreateActionMigrationRequest(variables),
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
