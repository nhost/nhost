import { buildActionMigrationRequest } from '@/features/orgs/projects/graphql/actions/utils/buildActionMigrationRequest';
import type { MigrationRequest } from '@/utils/hasura-api/generated/schemas';
import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';
import {
  buildStep,
  type ManageActionPermissionVariables,
} from './manageActionPermission';

export function buildManageActionPermissionMigrationRequest({
  action,
  role,
  type,
}: ManageActionPermissionVariables): MigrationRequest {
  const createStep = buildStep({
    action,
    role,
    type: 'create_action_permission',
  });
  const dropStep = buildStep({ action, role, type: 'drop_action_permission' });

  const granting = type === 'create_action_permission';

  const up = [granting ? createStep : dropStep];
  const down = [granting ? dropStep : createStep];

  return buildActionMigrationRequest(
    granting
      ? `save_action_permission_${action}_${role}`
      : `delete_action_permission_${action}_${role}`,
    { up, down },
  );
}

export default async function manageActionPermissionMigration({
  adminSecret,
  ...variables
}: MigrationOperationOptions & ManageActionPermissionVariables) {
  try {
    const response = await executeMigration(
      buildManageActionPermissionMigrationRequest(variables),
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
