import { useDialog } from '@/components/common/DialogProvider';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import type { DatabaseAction } from '@/types/dataBrowser';
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
import { useGetRolesQuery } from '@/utils/__generated__/graphql';
import NavLink from 'next/link';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';
import RolePermissionEditorForm from './RolePermissionEditorForm';
import RolePermissionsRow from './RolePermissionsRow';

export interface EditPermissionsFormProps {
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
  schema,
  table,
  onCancel,
}: EditPermissionsFormProps) {
  const [selectedRole, setSelectedRole] = useState<string>();
  const [selectedAction, setSelectedAction] = useState<DatabaseAction>();

  const { closeDrawerWithDirtyGuard } = useDialog();
  const { currentWorkspace, currentApplication } =
    useCurrentWorkspaceAndApplication();
  const { data, loading, error } = useGetRolesQuery({
    variables: { id: currentApplication?.id },
  });

  const roles = data?.app?.authUserDefaultAllowedRoles?.split(',') || [];

  if (loading) {
    return (
      <div className="p-6">
        <ActivityIndicator label="Loading available roles..." />
      </div>
    );
  }

  if (error) {
    throw error;
  }

  function handleSubmit() {
    setSelectedRole(undefined);
    setSelectedAction(undefined);
  }

  function handleCancel() {
    // TODO: Implement dirty guard

    setSelectedRole(undefined);
    setSelectedAction(undefined);
  }

  if (selectedRole && selectedAction) {
    return (
      <RolePermissionEditorForm
        schema={schema}
        table={table}
        selectedRole={selectedRole}
        selectedAction={selectedAction}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
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

                {roles.map((role, index) => (
                  <RolePermissionsRow
                    name={role}
                    key={role}
                    className={twMerge(
                      index === roles.length - 1 && 'border-b-0',
                    )}
                    onOperationClick={(operation) => {
                      setSelectedRole(role);
                      setSelectedAction(operation);
                    }}
                  />
                ))}
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
