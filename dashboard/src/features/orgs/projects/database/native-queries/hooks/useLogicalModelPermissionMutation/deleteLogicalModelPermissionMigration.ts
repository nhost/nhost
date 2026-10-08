import type { LogicalModelSelectPermission } from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelPermissionMutation/types';
import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export interface DeleteLogicalModelPermissionMigrationVariables {
  source: string;
  name: string;
  role: string;
  original: LogicalModelSelectPermission;
  originalComment?: string | null;
}

export default async function deleteLogicalModelPermissionMigration({
  adminSecret,
  source,
  name,
  role,
  original,
  originalComment,
}: MigrationOperationOptions & DeleteLogicalModelPermissionMigrationVariables) {
  const datasource = source;
  try {
    const response = await executeMigration(
      {
        name: `drop_logical_model_select_permission_${name}_${role}`,
        up: [
          {
            type: 'pg_drop_logical_model_select_permission',
            args: { source: datasource, name, role },
          },
        ],
        down: [
          {
            type: 'pg_create_logical_model_select_permission',
            args: {
              source: datasource,
              name,
              role,
              permission: original,
              ...(originalComment !== undefined
                ? { comment: originalComment }
                : {}),
            },
          },
        ],
        datasource,
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
