import type { LogicalModelMutationArgs } from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation/types';
import type {
  CreateLogicalModelSelectPermissionStep,
  LogicalModelItem,
  TrackLogicalModelArgs,
} from '@/utils/hasura-api/generated/schemas';
import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export interface EditLogicalModelMigrationVariables {
  source: string;
  args: LogicalModelMutationArgs;
  original: LogicalModelItem;
}

export default async function editLogicalModelMigration({
  adminSecret,
  source,
  args,
  original,
}: MigrationOperationOptions & EditLogicalModelMigrationVariables) {
  const datasource = source;
  const originalPermissions = original.select_permissions ?? [];
  const renamedPermissionSteps = originalPermissions.map(
    (permission) =>
      ({
        type: 'pg_create_logical_model_select_permission',
        args: { ...permission, name: args.name, source },
      }) satisfies CreateLogicalModelSelectPermissionStep,
  );
  const restoredPermissionSteps = originalPermissions.map(
    (permission) =>
      ({
        type: 'pg_create_logical_model_select_permission',
        args: { ...permission, name: original.name, source },
      }) satisfies CreateLogicalModelSelectPermissionStep,
  );
  const restoredArgs: TrackLogicalModelArgs = {
    name: original.name,
    fields: original.fields,
    ...(original.description === undefined
      ? {}
      : { description: original.description }),
    source,
  };

  try {
    const response = await executeMigration(
      {
        name: `update_logical_model_${original.name}`,
        up: [
          {
            type: 'bulk_atomic',
            args: [
              {
                type: 'pg_untrack_logical_model',
                args: { source: datasource, name: original.name },
              },
              {
                type: 'pg_track_logical_model',
                args: { ...args, source: datasource },
              },
            ],
          },
          ...renamedPermissionSteps,
        ],
        down: [
          {
            type: 'bulk_atomic',
            args: [
              {
                type: 'pg_untrack_logical_model',
                args: { source: datasource, name: args.name },
              },
              {
                type: 'pg_track_logical_model',
                args: restoredArgs,
              },
            ],
          },
          ...restoredPermissionSteps,
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
