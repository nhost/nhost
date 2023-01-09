import { useDialog } from '@/components/common/DialogProvider';
import useMetadataQuery from '@/hooks/dataBrowser/useMetadataQuery';
import useTableQuery from '@/hooks/dataBrowser/useTableQuery';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
import type {
  DatabaseAccessLevel,
  DatabaseAction,
  HasuraMetadataPermission,
} from '@/types/dataBrowser';
import { Alert } from '@/ui/Alert';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Button from '@/ui/v2/Button';
import FullPermissionIcon from '@/ui/v2/icons/FullPermissionIcon';
import NoPermissionIcon from '@/ui/v2/icons/NoPermissionIcon';
import PartialPermissionIcon from '@/ui/v2/icons/PartialPermissionIcon';
import Link from '@/ui/v2/Link';
import Table from '@/ui/v2/Table';
import TableBody from '@/ui/v2/TableBody';
import TableCell from '@/ui/v2/TableCell';
import TableContainer from '@/ui/v2/TableContainer';
import TableHead from '@/ui/v2/TableHead';
import TableRow from '@/ui/v2/TableRow';
import Text from '@/ui/v2/Text';
import { useGetRemoteAppRolesQuery } from '@/utils/__generated__/graphql';
import NavLink from 'next/link';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';
import RolePermissionEditorForm from './RolePermissionEditorForm';
import RolePermissionsRow from './RolePermissionsRow';

export interface EditPermissionsFormProps {
  /**
   * Determines whether the form is disabled or not.
   */
  disabled?: boolean;
  /**
   * The schema that is being edited.
   */
  schema: string;
  /**
   * The table that is being edited.
   */
  table: string;
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
}

export default function EditPermissionsForm({
  disabled,
  schema,
  table,
  onCancel,
}: EditPermissionsFormProps) {
  const [role, setRole] = useState<string>();
  const [action, setAction] = useState<DatabaseAction>();

  const { closeDrawerWithDirtyGuard } = useDialog();
  const { currentWorkspace, currentApplication } =
    useCurrentWorkspaceAndApplication();

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
  } = useTableQuery([`default.${schema}.${table}`], { schema, table });

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
      (!permission?.check && !permission && permission?.columns?.length === 0)
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
        disabled={disabled}
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
    <div className="flex flex-auto flex-col content-between overflow-hidden border-t-1 border-gray-200 bg-[#fafafa]">
      <div className="flex-auto">
        <section className="grid grid-flow-row gap-6 content-start overflow-y-auto p-6 bg-white border-b-1 border-gray-200">
          <div className="grid grid-flow-row gap-2">
            <Text component="h2" className="!font-bold">
              Roles & Actions overview
            </Text>

            <Text>
              Rules for each role and action can be set by clicking on the
              corresponding cell.
            </Text>
          </div>

          <div className="grid grid-flow-col gap-4 items-center justify-start">
            <Text
              variant="subtitle2"
              className="!text-greyscaleDark grid items-center grid-flow-col gap-1"
            >
              full access <FullPermissionIcon />
            </Text>

            <Text
              variant="subtitle2"
              className="!text-greyscaleDark grid items-center grid-flow-col gap-1"
            >
              partial access <PartialPermissionIcon />
            </Text>

            <Text
              variant="subtitle2"
              className="!text-greyscaleDark grid items-center grid-flow-col gap-1"
            >
              no access <NoPermissionIcon />
            </Text>
          </div>

          <TableContainer>
            <Table>
              <TableHead className="block">
                <TableRow className="grid grid-cols-5 items-center">
                  <TableCell className="border-b-0 p-2">Role</TableCell>

                  <TableCell className="border-b-0 p-2 text-center">
                    Insert
                  </TableCell>

                  <TableCell className="border-b-0 p-2 text-center">
                    Select
                  </TableCell>

                  <TableCell className="border-b-0 p-2 text-center">
                    Update
                  </TableCell>

                  <TableCell className="border-b-0 p-2 text-center">
                    Delete
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody className="rounded-sm+ block border-1">
                <RolePermissionsRow
                  name="admin"
                  disabled
                  accessLevels={{
                    insert: 'full',
                    select: 'full',
                    update: 'full',
                    delete: 'full',
                  }}
                />

                {availableRoles.map((currentRole, index) => {
                  const insertPermissions =
                    metadataForTable?.insert_permissions?.find(
                      ({ role: permissionRole }) =>
                        permissionRole === currentRole,
                    );

                  const selectPermissions =
                    metadataForTable?.select_permissions?.find(
                      ({ role: permissionRole }) =>
                        permissionRole === currentRole,
                    );

                  const updatePermissions =
                    metadataForTable?.update_permissions?.find(
                      ({ role: permissionRole }) =>
                        permissionRole === currentRole,
                    );

                  const deletePermissions =
                    metadataForTable?.delete_permissions?.find(
                      ({ role: permissionRole }) =>
                        permissionRole === currentRole,
                    );

                  return (
                    <RolePermissionsRow
                      name={currentRole}
                      key={currentRole}
                      className={twMerge(
                        index === availableRoles.length - 1 && 'border-b-0',
                      )}
                      onActionSelect={(selectedAction) => {
                        setRole(currentRole);
                        setAction(selectedAction);
                      }}
                      accessLevels={{
                        insert: getAccessLevel(insertPermissions?.permission),
                        select: getAccessLevel(selectPermissions?.permission),
                        update: getAccessLevel(updatePermissions?.permission),
                        delete: getAccessLevel(deletePermissions?.permission),
                      }}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <Alert className="text-left">
            Please go to the{' '}
            <NavLink
              href={`/${currentWorkspace.slug}/${currentApplication.slug}/settings/roles-and-permissions`}
              passHref
            >
              <Link
                href="settings/roles-and-permissions"
                underline="hover"
                onClick={closeDrawerWithDirtyGuard}
              >
                Settings page
              </Link>
            </NavLink>{' '}
            to add and delete roles.
          </Alert>
        </section>
      </div>

      <div className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t-1 border-gray-200 p-2 bg-white">
        <Button variant="borderless" color="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
