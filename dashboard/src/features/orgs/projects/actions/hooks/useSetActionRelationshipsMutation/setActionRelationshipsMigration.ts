import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type {
  MigrationRequest,
  MigrationStep,
  SetCustomTypesStep,
} from '@/utils/hasura-api/generated/schemas';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';
import type { SetActionRelationshipsVariables } from './setActionRelationships';

export function buildSetActionRelationshipsMigrationRequest({
  customTypes,
  previousCustomTypes,
  relationshipName,
  outputTypeName,
  mode,
}: SetActionRelationshipsVariables): MigrationRequest {
  // The generated MigrationStep union omits action operations, but the migrate
  // API accepts them, so the assembled steps are cast.
  const up = [
    {
      type: 'set_custom_types',
      args: customTypes,
    } satisfies SetCustomTypesStep,
  ] as unknown as MigrationStep[];

  const down = [
    {
      type: 'set_custom_types',
      args: previousCustomTypes,
    } satisfies SetCustomTypesStep,
  ] as unknown as MigrationStep[];

  return {
    name:
      mode === 'remove'
        ? `remove_action_relationship_${relationshipName}_from_${outputTypeName}`
        : `save_rel_${relationshipName}_on_${outputTypeName}`,
    up,
    down,
    datasource: 'default',
    skip_execution: false,
  };
}

export default async function setActionRelationshipsMigration({
  appUrl,
  adminSecret,
  ...variables
}: MigrationOperationOptions & SetActionRelationshipsVariables) {
  try {
    const response = await executeMigration(
      buildSetActionRelationshipsMigrationRequest(variables),
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
