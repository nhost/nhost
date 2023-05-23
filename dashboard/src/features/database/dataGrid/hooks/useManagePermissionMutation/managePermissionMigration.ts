import type {
  AffectedRowsResult,
  DatabaseAction,
  HasuraMetadataPermission,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/database/dataGrid/types/dataBrowser';
import { normalizeQueryError } from '@/features/database/dataGrid/utils/normalizeQueryError';
import { getHasuraMigrationsApiUrl } from '@/utils/env';

export interface ManagePermissionMigrationVariables {
  /**
   * The role to manage the permission for.
   */
  role: string;
  /**
   * The action to manage the permission for.
   */
  action: DatabaseAction;
  /**
   * The resource version of the metadata.
   */
  resourceVersion: number;
  /**
   * Permission to insert or update.
   */
  permission?: HasuraMetadataPermission['permission'];
  /**
   * The original permission to use for the down migration when updating and the
   * up migration when deleting.
   */
  originalPermission?: HasuraMetadataPermission['permission'];
  /**
   * The mode to use when managing the permission.
   *
   * Available modes:
   * - `create`: Creates the permission using the provided object.
   * - `update`: Drops the permission and creates it again using the provided object.
   * - `delete`: Drops the permission.
   *
   * @default 'update'
   */
  mode?: 'insert' | 'update' | 'delete';
}

export interface ManagePermissionMigrationOptions
  extends MutationOrQueryBaseOptions {}

export default async function managePermissionMigration({
  dataSource,
  schema,
  adminSecret,
  table,
  permission,
  originalPermission,
  role,
  action,
  mode = 'update',
}: ManagePermissionMigrationOptions & ManagePermissionMigrationVariables) {
  if (mode !== 'delete' && !permission) {
    throw new Error('A permission object must be provided.');
  }

  if (mode === 'delete' && !originalPermission) {
    throw new Error(
      'An original permission object must be provided when mode is "delete".',
    );
  }

  const deleteArgs = {
    type: `pg_drop_${action}_permission`,
    args: { table: { schema, name: table }, source: dataSource, role },
  };

  const insertArgs = {
    type: `pg_create_${action}_permission`,
    args: {
      source: dataSource,
      table: { schema, name: table },
      role,
      permission,
    },
  };

  let args: { up: any[]; down: any[] } = {
    up: [],
    down: [],
  };

  if (mode === 'delete') {
    args = {
      down: [
        {
          ...insertArgs,
          args: { ...insertArgs.args, permission: originalPermission },
        },
      ],
      up: [deleteArgs],
    };
  } else if (mode === 'insert') {
    args = { down: [deleteArgs], up: [insertArgs] };
  } else {
    args = {
      down: [
        {
          ...insertArgs,
          args: { ...insertArgs.args, permission: originalPermission },
        },
        deleteArgs,
      ],
      up: [deleteArgs, insertArgs],
    };
  }

  const response = await fetch(`${getHasuraMigrationsApiUrl()}/apis/migrate`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      dataSource,
      skip_execution: false,
      name: `change_${action}_permission_${role}_${schema}_${table}`,
      down: args.down,
      up: args.up,
    }),
  });

  const responseData: [AffectedRowsResult, QueryResult<string[]>] | QueryError =
    await response.json();

  if (response.ok) {
    return;
  }

  const normalizedError = normalizeQueryError(responseData);

  throw new Error(normalizedError);
}
