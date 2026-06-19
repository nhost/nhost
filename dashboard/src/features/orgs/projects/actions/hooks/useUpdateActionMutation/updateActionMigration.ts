import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type {
  CreateActionArgs,
  MigrationRequest,
  MigrationStep,
  SetCustomTypesStep,
  UpdateActionStep,
} from '@/utils/hasura-api/generated/schemas';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';
import type { UpdateActionVariables } from './updateAction';

export function buildUpdateActionMigrationRequest({
  args,
  customTypes,
  previousCustomTypes,
  originalAction,
}: UpdateActionVariables): MigrationRequest {
  const originalArgs: CreateActionArgs = {
    name: originalAction.name,
    definition: originalAction.definition,
    ...(originalAction.comment !== undefined
      ? { comment: originalAction.comment }
      : {}),
  };

  // The generated MigrationStep union omits action operations, but the migrate
  // API accepts them, so the assembled steps are cast.
  const up = [
    {
      type: 'set_custom_types',
      args: customTypes,
    } satisfies SetCustomTypesStep,
    {
      type: 'update_action',
      args,
    } satisfies UpdateActionStep,
  ] as unknown as MigrationStep[];

  const down = [
    {
      type: 'update_action',
      args: originalArgs,
    } satisfies UpdateActionStep,
    {
      type: 'set_custom_types',
      args: previousCustomTypes,
    } satisfies SetCustomTypesStep,
  ] as unknown as MigrationStep[];

  return {
    name: `modify_action_${originalAction.name}_to_${args.name}`,
    up,
    down,
    datasource: 'default',
    skip_execution: false,
  };
}

export default async function updateActionMigration({
  appUrl,
  adminSecret,
  ...variables
}: MigrationOperationOptions & UpdateActionVariables) {
  try {
    const response = await executeMigration(
      buildUpdateActionMigrationRequest(variables),
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
