import { buildActionMigrationRequest } from '@/features/orgs/projects/graphql/actions/utils/buildActionMigrationRequest';
import type {
  CreateActionArgs,
  CreateActionStep,
  DropActionOperation,
  MigrationRequest,
} from '@/utils/hasura-api/generated/schemas';
import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';
import type { DeleteActionVariables } from './deleteAction';

export function buildDeleteActionMigrationRequest({
  action,
}: DeleteActionVariables): MigrationRequest {
  const recreateArgs: CreateActionArgs = {
    name: action.name,
    definition: action.definition,
    ...(action.comment !== undefined ? { comment: action.comment } : {}),
  };

  const up = [
    {
      type: 'drop_action',
      args: { name: action.name },
    } satisfies DropActionOperation,
  ];

  const down = [
    {
      type: 'create_action',
      args: recreateArgs,
    } satisfies CreateActionStep,
  ];

  return buildActionMigrationRequest(`delete_action_${action.name}`, {
    up,
    down,
  });
}

export default async function deleteActionMigration({
  adminSecret,
  ...variables
}: MigrationOperationOptions & DeleteActionVariables) {
  try {
    const response = await executeMigration(
      buildDeleteActionMigrationRequest(variables),
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
