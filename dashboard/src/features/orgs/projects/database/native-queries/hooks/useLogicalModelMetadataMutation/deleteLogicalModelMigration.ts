import type {
  CreateLogicalModelSelectPermissionStep,
  LogicalModelItem,
  TrackLogicalModelArgs,
} from '@/utils/hasura-api/generated/schemas';
import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export interface DeleteLogicalModelMigrationVariables {
  source: string;
  original: LogicalModelItem;
}

export default async function deleteLogicalModelMigration({
  adminSecret,
  source,
  original,
}: MigrationOperationOptions & DeleteLogicalModelMigrationVariables) {
  const datasource = source;
  const restoredArgs: TrackLogicalModelArgs = {
    name: original.name,
    fields: original.fields,
    ...(original.description === undefined
      ? {}
      : { description: original.description }),
    source,
  };
  const restoredPermissionSteps = (original.select_permissions ?? []).map(
    (permission) =>
      ({
        type: 'pg_create_logical_model_select_permission',
        args: { ...permission, source: datasource, name: original.name },
      }) satisfies CreateLogicalModelSelectPermissionStep,
  );

  try {
    const response = await executeMigration(
      {
        name: `untrack_logical_model_${original.name}`,
        up: [
          {
            type: 'bulk_atomic',
            args: [
              {
                type: 'pg_untrack_logical_model',
                args: { source: datasource, name: original.name },
              },
            ],
          },
        ],
        down: [
          {
            type: 'bulk_atomic',
            args: [
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
