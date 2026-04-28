import { useState } from 'react';
import {
  findPermission,
  PermissionsGrid,
} from '@/components/common/PermissionsGrid';
import { PermissionsGridLayout } from '@/components/common/PermissionsGridLayout';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { useTableSchemaQuery } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import { useMetadataQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useMetadataQuery';
import type {
  DatabaseAccessLevel,
  DatabaseAction,
  DatabaseObjectType,
  HasuraMetadataPermission,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getAllowedActions } from '@/features/orgs/projects/database/dataGrid/utils/getAllowedActions';
import type { DialogFormProps } from '@/types/common';
import { useGetRemoteAppRolesQuery } from '@/utils/__generated__/graphql';
import RolePermissionEditorForm from './RolePermissionEditorForm';

const actionLabels: Record<DatabaseAction, string> = {
  insert: 'Insert',
  select: 'Select',
  update: 'Update',
  delete: 'Delete',
};

export interface EditPermissionsFormProps extends DialogFormProps {
  /**
   * The schema that is being edited.
   */
  schema: string;
  /**
   * The table that is being edited.
   */
  table: string;
  /**
   * The type of database object (table, view, etc.).
   */
  objectType?: DatabaseObjectType;
  /**
   * Bitmask from pg_relation_is_updatable(oid, true) indicating which
   * operations the relation supports (8=insert, 4=update, 16=delete).
   */
  updatability?: number;
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
}

export default function EditPermissionsForm({
  schema,
  table,
  objectType,
  updatability,
  onCancel,
  location,
}: EditPermissionsFormProps) {
  const [role, setRole] = useState<string>();
  const [action, setAction] = useState<DatabaseAction>();
  const allowedActions = getAllowedActions(objectType, updatability);

  const client = useRemoteApplicationGQLClient();
  const {
    data: rolesData,
    loading: rolesLoading,
    error: rolesError,
  } = useGetRemoteAppRolesQuery({ client });

  const {
    data: tableData,
    status: tableStatus,
    error: tableError,
  } = useTableSchemaQuery([`default.${schema}.${table}`], { schema, table });

  const {
    data: metadata,
    status: metadataStatus,
    error: metadataError,
  } = useMetadataQuery([`default.metadata`]);

  if (tableStatus === 'loading') {
    return (
      <div className="p-6">
        <ActivityIndicator label="Loading table..." />
      </div>
    );
  }

  if (tableError) {
    throw tableError;
  }

  if (metadataStatus === 'loading') {
    return (
      <div className="p-6">
        <ActivityIndicator label="Loading table metadata..." />
      </div>
    );
  }

  if (metadataError) {
    throw metadataError;
  }

  if (rolesLoading) {
    return (
      <div className="p-6">
        <ActivityIndicator label="Loading available roles..." />
      </div>
    );
  }

  if (rolesError) {
    throw rolesError;
  }

  const availableRoles = [
    'public',
    ...(rolesData?.authRoles?.map(({ role: authRole }) => authRole) || []),
  ];

  const metadataForTable = metadata?.tables?.find(
    ({ table: currentTable }) =>
      currentTable.name === table && currentTable.schema === schema,
  );

  const availableColumns =
    tableData?.columns.map((column) => column.column_name) || [];

  function handleSubmit() {
    setRole(undefined);
    setAction(undefined);
  }

  function handleCancel() {
    setRole(undefined);
    setAction(undefined);
  }

  function getAccessLevel(
    permission?: HasuraMetadataPermission['permission'],
  ): DatabaseAccessLevel {
    if (
      !permission ||
      (!permission?.check && permission && permission?.columns?.length === 0)
    ) {
      return 'none';
    }

    const sortedTableColumns = [...availableColumns].sort();
    const isAllColumnSelected =
      sortedTableColumns.length === permission?.columns?.length &&
      [...(permission?.columns || [])]
        .sort()
        .every(
          (permissionColumn, index) =>
            permissionColumn === sortedTableColumns[index],
        );

    if (
      Object.keys(permission?.check || {}).length === 0 &&
      Object.keys(permission?.filter || {}).length === 0 &&
      isAllColumnSelected
    ) {
      return 'full';
    }

    return 'partial';
  }

  if (role && action) {
    return (
      <RolePermissionEditorForm
        key={`${role}.${action}`}
        location={location}
        resourceVersion={metadata?.resourceVersion as number}
        schema={schema}
        table={table}
        role={role}
        action={action}
        availableRoles={availableRoles}
        allowedActions={allowedActions}
        actionLabels={actionLabels}
        onRoleChange={setRole}
        onActionChange={setAction}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        permission={findPermission(metadataForTable, role, action)}
      />
    );
  }

  return (
    <PermissionsGridLayout onCancel={onCancel}>
      <PermissionsGrid
        roles={availableRoles}
        actions={allowedActions}
        actionLabels={actionLabels}
        getAccessLevel={(currentRole, dbAction) =>
          getAccessLevel(
            findPermission(metadataForTable, currentRole, dbAction),
          )
        }
        onSelect={(selectedRole, selectedAction) => {
          setRole(selectedRole);
          setAction(selectedAction);
        }}
      />
    </PermissionsGridLayout>
  );
}
