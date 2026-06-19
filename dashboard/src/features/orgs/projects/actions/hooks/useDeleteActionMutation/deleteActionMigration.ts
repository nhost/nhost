import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type {
  CreateActionArgs,
  CreateActionStep,
  DropActionOperation,
  MigrationRequest,
  MigrationStep,
} from '@/utils/hasura-api/generated/schemas';
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

  // The generated MigrationStep union omits action operations, but the migrate
  // API accepts them, so the assembled steps are cast.
  const up = [
    {
      type: 'drop_action',
      args: { name: action.name },
    } satisfies DropActionOperation,
  ] as unknown as MigrationStep[];

  const down = [
    {
      type: 'create_action',
      args: recreateArgs,
    } satisfies CreateActionStep,
  ] as unknown as MigrationStep[];

  return {
    name: `delete_action_${action.name}`,
    up,
    down,
    datasource: 'default',
    skip_execution: false,
  };
}

export default async function deleteActionMigration({
  appUrl,
  adminSecret,
  ...variables
}: MigrationOperationOptions & DeleteActionVariables) {
  try {
    const response = await executeMigration(
      buildDeleteActionMigrationRequest(variables),
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
