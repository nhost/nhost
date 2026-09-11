import type { LogicalModelPermissionArgs } from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelPermissionMutation/types';
import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export interface CreateLogicalModelPermissionMigrationVariables {
  source: string;
  args: LogicalModelPermissionArgs;
}

export default async function createLogicalModelPermissionMigration({
  adminSecret,
  source,
  args,
}: MigrationOperationOptions & CreateLogicalModelPermissionMigrationVariables) {
  const datasource = source;
  try {
    const response = await executeMigration(
      {
        name: `create_logical_model_select_permission_${args.name}_${args.role}`,
        up: [
          {
            type: 'pg_create_logical_model_select_permission',
            args: { ...args, source: datasource },
          },
        ],
        down: [
          {
            type: 'pg_drop_logical_model_select_permission',
            args: { source: datasource, name: args.name, role: args.role },
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
