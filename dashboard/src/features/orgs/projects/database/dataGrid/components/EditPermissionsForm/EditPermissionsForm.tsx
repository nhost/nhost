import { useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { NavLink } from '@/components/common/NavLink';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { FullPermissionIcon } from '@/components/ui/v2/icons/FullPermissionIcon';
import { NoPermissionIcon } from '@/components/ui/v2/icons/NoPermissionIcon';
import { PartialPermissionIcon } from '@/components/ui/v2/icons/PartialPermissionIcon';
import { Table } from '@/components/ui/v2/Table';
import { TableBody } from '@/components/ui/v2/TableBody';
import { TableCell } from '@/components/ui/v2/TableCell';
import { TableContainer } from '@/components/ui/v2/TableContainer';
import { TableHead } from '@/components/ui/v2/TableHead';
import { TableRow } from '@/components/ui/v2/TableRow';
import { Text } from '@/components/ui/v2/Text';
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
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { DialogFormProps } from '@/types/common';
import { useGetRemoteAppRolesQuery } from '@/utils/__generated__/graphql';
import RolePermissionEditorForm from './RolePermissionEditorForm';
import RolePermissionsRow from './RolePermissionsRow';

const actionLabels: Record<DatabaseAction, string> = {
  insert: 'Insert',
  select: 'Select',
  update: 'Update',
  delete: 'Delete',
};

const gridColsMap: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
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

  const { project } = useProject();
  const { org } = useCurrentOrg();

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
    const permissionsForAction = {
      insert: metadataForTable?.insert_permissions,
      select: metadataForTable?.select_permissions,
      update: metadataForTable?.update_permissions,
      delete: metadataForTable?.delete_permissions,
    };

    return (
      <RolePermissionEditorForm
        location={location}
        resourceVersion={metadata?.resourceVersion as number}
        schema={schema}
        table={table}
        role={role}
        action={action}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        permission={
          permissionsForAction[action]?.find(
            ({ role: currentRole }) => currentRole === role,
          )?.permission
        }
      />
    );
  }

  return (
    <Box
      className="flex flex-auto flex-col content-between overflow-hidden border-t-1"
      sx={{ backgroundColor: 'background.default' }}
    >
      <div className="flex-auto">
        <Box className="grid grid-flow-row content-start gap-6 overflow-y-auto border-b-1 p-6">
          <div className="grid grid-flow-row gap-2">
            <Text component="h2" className="!font-bold">
              Roles & Actions overview
            </Text>

            <Text>
              Rules for each role and action can be set by clicking on the
              corresponding cell.
            </Text>
          </div>

          <div className="grid grid-flow-col items-center justify-start gap-4">
            <Text
              variant="subtitle2"
              className="grid grid-flow-col items-center gap-1"
            >
              full access <FullPermissionIcon />
            </Text>

            <Text
              variant="subtitle2"
              className="grid grid-flow-col items-center gap-1"
            >
              partial access <PartialPermissionIcon />
            </Text>

            <Text
              variant="subtitle2"
              className="grid grid-flow-col items-center gap-1"
            >
              no access <NoPermissionIcon />
            </Text>
          </div>

          <TableContainer sx={{ backgroundColor: 'background.paper' }}>
            <Table>
              <TableHead className="block">
                <TableRow
                  className={`grid ${gridColsMap[allowedActions.length + 1] || 'grid-cols-5'} items-center`}
                >
                  <TableCell className="border-b-0 p-2">Role</TableCell>

                  {allowedActions.map((actionKey) => (
                    <TableCell
                      key={actionKey}
                      className="border-b-0 p-2 text-center"
                    >
                      {actionLabels[actionKey]}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>

              <TableBody className="block rounded-sm+ border-1">
                <RolePermissionsRow
                  name="admin"
                  disabled
                  actions={allowedActions}
                  accessLevels={
                    Object.fromEntries(
                      allowedActions.map((a) => [a, 'full' as const]),
                    ) as Record<DatabaseAction, DatabaseAccessLevel>
                  }
                />

                {availableRoles.map((currentRole, index) => {
                  const permissionsByAction: Record<
                    DatabaseAction,
                    ReturnType<typeof getAccessLevel>
                  > = {
                    insert: getAccessLevel(
                      metadataForTable?.insert_permissions?.find(
                        ({ role: permissionRole }) =>
                          permissionRole === currentRole,
                      )?.permission,
                    ),
                    select: getAccessLevel(
                      metadataForTable?.select_permissions?.find(
                        ({ role: permissionRole }) =>
                          permissionRole === currentRole,
                      )?.permission,
                    ),
                    update: getAccessLevel(
                      metadataForTable?.update_permissions?.find(
                        ({ role: permissionRole }) =>
                          permissionRole === currentRole,
                      )?.permission,
                    ),
                    delete: getAccessLevel(
                      metadataForTable?.delete_permissions?.find(
                        ({ role: permissionRole }) =>
                          permissionRole === currentRole,
                      )?.permission,
                    ),
                  };

                  return (
                    <RolePermissionsRow
                      name={currentRole}
                      key={currentRole}
                      actions={allowedActions}
                      className={twMerge(
                        index === availableRoles.length - 1 && 'border-b-0',
                      )}
                      onActionSelect={(selectedAction) => {
                        setRole(currentRole);
                        setAction(selectedAction);
                      }}
                      accessLevels={permissionsByAction}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <Alert className="text-left">
            Please go to the{' '}
            <NavLink
              href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/roles-and-permissions`}
              underline="hover"
              className="px-0"
            >
              Settings page
            </NavLink>{' '}
            to add and delete roles.
          </Alert>
        </Box>
      </div>

      <Box className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t-1 p-2">
        <Button variant="borderless" color="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </Box>
    </Box>
  );
}
