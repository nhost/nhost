import type {
  AffectedRowsResult,
  DatabaseAction,
  HasuraMetadataPermission,
  MetadataError,
  MutationOrQueryBaseOptions,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { normalizeMetadataError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeMetadataError';

export interface ManagePermissionVariables {
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

export interface ManagePermissionOptions extends MutationOrQueryBaseOptions {}

export default async function managePermission({
  dataSource,
  schema,
  appUrl,
  adminSecret,
  table,
  permission,
  role,
  action,
  resourceVersion,
  mode = 'update',
}: ManagePermissionOptions & ManagePermissionVariables) {
  if (mode !== 'delete' && !permission) {
    throw new Error(
      'A permission must be provided when creating or updating a permission.',
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

  let args = [];

  if (mode === 'delete') {
    args = [deleteArgs];
  } else if (mode === 'insert') {
    args = [insertArgs];
  } else {
    args = [deleteArgs, insertArgs];
  }

  const response = await fetch(`${appUrl}/v1/metadata`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      args,
      type: 'bulk',
      source: dataSource,
      resource_version: resourceVersion,
    }),
  });

  const responseData:
    | [AffectedRowsResult, QueryResult<string[]>]
    | MetadataError = await response.json();

  if (response.ok) {
    return;
  }

  const normalizedError = normalizeMetadataError(responseData);

  throw new Error(normalizedError);
}
