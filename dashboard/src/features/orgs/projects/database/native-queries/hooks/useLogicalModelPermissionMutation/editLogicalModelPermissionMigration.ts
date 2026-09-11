import type {
  LogicalModelPermissionArgs,
  LogicalModelSelectPermission,
} from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelPermissionMutation/types';
import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export interface EditLogicalModelPermissionMigrationVariables {
  source: string;
  args: LogicalModelPermissionArgs;
  original: LogicalModelSelectPermission;
}

export default async function editLogicalModelPermissionMigration({
  adminSecret,
  source,
  args,
  original,
}: MigrationOperationOptions & EditLogicalModelPermissionMigrationVariables) {
  const datasource = source;
  const dropStep = {
    type: 'pg_drop_logical_model_select_permission',
    args: { source: datasource, name: args.name, role: args.role },
  } as const;

  try {
    const response = await executeMigration(
      {
        name: `update_logical_model_select_permission_${args.name}_${args.role}`,
        up: [
          dropStep,
          {
            type: 'pg_create_logical_model_select_permission',
            args: { ...args, source: datasource },
          },
        ],
        down: [
          dropStep,
          {
            type: 'pg_create_logical_model_select_permission',
            args: { ...args, source: datasource, permission: original },
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
